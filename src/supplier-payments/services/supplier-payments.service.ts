import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  CashDirection,
  CashMovementType,
  ReferenceType,
  RecordStatus,
} from '../../generated/prisma/enums.js';
import { CreateSupplierPaymentDto } from '../dto/create-supplier-payment.dto.js';
import { CancelSupplierPaymentDto } from '../dto/cancel-supplier-payment.dto.js';
import { SupplierPaymentQueryFilterDto } from '../dto/supplier-payment-query.filter.js';
import {
  ResponseSupplierPaymentDto,
  SupplierPayableDto,
  UnpaidPurchaseDto,
} from '../dto/response-supplier-payment.dto.js';
import {
  SUPPLIER_PAYMENT_INCLUDE,
  mapSupplierPaymentToResponse,
  openingRemaining,
  purchaseRemaining,
} from '../helpers/supplier-payment.mapper.js';
import { SupplierPaymentsCancelService } from './supplier-payments-cancel.service.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { CancelImpactResponseDto } from '../../common-dto/response/cancel-impact.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  buildTokenizedSearchAnd,
  stripDocSearchPrefix,
} from '../../helpers/tokenized-search.helper.js';
import { aggregateCurrentCash } from '../../helpers/cash-balance.helper.js';
import {
  paymentExceedsOutstanding,
  resourceNotFound,
} from '../../errors/error.builder.js';
import { buildAmountRangeFilter } from '../../common-dto/helpers/amount-range-filter.helper.js';
import { resolveTransactionDate } from '../../helpers/date.helper.js';
import {
  isUniqueConstraintViolation,
  violatedColumn,
} from '../../helpers/prisma-error-helper.js';

export type CreateSupplierPaymentResult =
  StatusBaseResponseDTO | PurchaseOverdraftResponseDto;

const CREATED = 'Supplier payment recorded successfully';
const ALREADY_SAVED = 'Supplier payment already saved';

@Injectable()
export class SupplierPaymentsService {
  private readonly logger = new Logger(SupplierPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cancelService: SupplierPaymentsCancelService,
  ) {}

  async createSupplierPayment(
    dto: CreateSupplierPaymentDto,
    shopId: string,
    userId: string,
  ): Promise<CreateSupplierPaymentResult> {
    const existing = await this.prisma.supplierPayment.findFirst({
      where: { shopId, clientRequestId: dto.clientRequestId },
      select: { id: true },
    });
    if (existing) {
      return new StatusBaseResponseDTO(true, ALREADY_SAVED);
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, shopId },
      select: { id: true, name: true },
    });
    if (!supplier) {
      throw new NotFoundException(resourceNotFound('Supplier', dto.supplierId));
    }

    const amount = BigInt(dto.amount);

    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const shop = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE
        `;
        if (!shop?.length) {
          throw new NotFoundException(resourceNotFound('Shop', shopId));
        }

        const locked = await tx.$queryRaw<
          Array<{ opening_balance: bigint | string }>
        >`
          SELECT opening_balance FROM suppliers
          WHERE id = ${dto.supplierId} AND shop_id = ${shopId}
          FOR UPDATE
        `;
        if (!locked?.length) {
          throw new NotFoundException(
            resourceNotFound('Supplier', dto.supplierId),
          );
        }
        const openingBalance = BigInt(locked[0].opening_balance);

        const remaining = dto.purchaseId
          ? await purchaseRemaining(tx, dto, supplier.name, shopId)
          : await openingRemaining(tx, dto.supplierId, shopId, openingBalance);

        if (amount > remaining) {
          throw new BadRequestException(
            paymentExceedsOutstanding(
              supplier.name,
              Number(amount),
              Number(remaining),
            ),
          );
        }

        let overdraft = false;
        const after = (await aggregateCurrentCash(tx, shopId)) - Number(amount);
        if (after < 0) {
          if (!dto.confirmOverdraft) {
            return { kind: 'overdraft' as const, shortfall: -after };
          }
          overdraft = true;
        }

        const paymentMoment = resolveTransactionDate(dto.paymentDate);

        const payment = await tx.supplierPayment.create({
          data: {
            shopId,
            supplierId: dto.supplierId,
            purchaseId: dto.purchaseId ?? null,
            amount,
            paymentDate: paymentMoment,
            clientRequestId: dto.clientRequestId,
            notes: dto.notes?.trim() ? dto.notes : null,
            createdById: userId,
          },
          select: { id: true },
        });

        await tx.cashMovement.create({
          data: {
            shopId,
            type: CashMovementType.SUPPLIER_PAYMENT,
            direction: CashDirection.OUT,
            amount,
            movementDate: paymentMoment,
            referenceType: ReferenceType.SUPPLIER_PAYMENT,
            referenceId: payment.id,
            isOverdraft: overdraft,
            note: dto.notes?.trim() ? dto.notes : null,
            createdById: userId,
          },
        });

        return { kind: 'created' as const };
      });

      if (outcome.kind === 'overdraft') {
        return new PurchaseOverdraftResponseDto(outcome.shortfall);
      }
      return new StatusBaseResponseDTO(true, CREATED);
    } catch (error) {
      if (
        isUniqueConstraintViolation(error) &&
        violatedColumn(error, 'client_request_id')
      ) {
        return new StatusBaseResponseDTO(true, ALREADY_SAVED);
      }
      throw error;
    }
  }

  cancelSupplierPayment(
    id: string,
    dto: CancelSupplierPaymentDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    return this.cancelService.cancelSupplierPayment(id, dto, shopId, userId);
  }

  getCancelImpact(
    id: string,
    shopId: string,
  ): Promise<CancelImpactResponseDto> {
    return this.cancelService.getCancelImpact(id, shopId);
  }

  async getSupplierPayments(
    query: SupplierPaymentQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseSupplierPaymentDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'paymentDate';
    const sortOrder: Prisma.SortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.SupplierPaymentWhereInput = { shopId };
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.purchaseId) where.purchaseId = query.purchaseId;
    if (query.status) where.status = query.status;

    const andFilters: Prisma.SupplierPaymentWhereInput[] = [];
    if (query.from)
      andFilters.push({ paymentDate: { gte: new Date(query.from) } });
    if (query.to) andFilters.push({ paymentDate: { lte: new Date(query.to) } });
    const amountFilter = buildAmountRangeFilter(
      query.minAmount,
      query.maxAmount,
    );
    if (amountFilter) andFilters.push({ amount: amountFilter });
    andFilters.push(
      ...buildTokenizedSearchAnd<Prisma.SupplierPaymentWhereInput>(
        query.search,
        (token) => {
          const billTerm = stripDocSearchPrefix(token);
          return [
            { supplier: { name: { contains: token, mode: 'insensitive' } } },
            { notes: { contains: token, mode: 'insensitive' } },
            {
              purchase: {
                purchaseNo: { contains: billTerm, mode: 'insensitive' },
              },
            },
          ];
        },
      ),
    );
    if (andFilters.length > 0) where.AND = andFilters;

    const orderBy: Prisma.SupplierPaymentOrderByWithRelationInput[] =
      sortBy === 'supplierName'
        ? [
            { supplier: { name: sortOrder } },
            { paymentDate: sortOrder },
            { createdAt: sortOrder },
            { id: sortOrder },
          ]
        : sortBy === 'amount'
          ? [
              { amount: sortOrder },
              { paymentDate: 'desc' },
              { createdAt: 'desc' },
              { id: 'desc' },
            ]
          : [
              { paymentDate: sortOrder },
              { createdAt: sortOrder },
              { id: sortOrder },
            ];

    const [rows, total] = await Promise.all([
      this.prisma.supplierPayment.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy,
        include: SUPPLIER_PAYMENT_INCLUDE,
      }),
      this.prisma.supplierPayment.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseSupplierPaymentDto>(
      rows.map((row) => mapSupplierPaymentToResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getSupplierPayable(
    supplierId: string,
    shopId: string,
  ): Promise<SupplierPayableDto> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, shopId },
      select: { id: true, name: true, openingBalance: true },
    });
    if (!supplier) {
      throw new NotFoundException(resourceNotFound('Supplier', supplierId));
    }

    const [purchases, payments] = await Promise.all([
      this.prisma.purchase.findMany({
        where: {
          shopId,
          supplierId,
          status: RecordStatus.ACTIVE,
          isOpeningStock: false,
        },
        orderBy: { purchaseDate: 'asc' },
        select: {
          id: true,
          purchaseNo: true,
          supplierInvoiceRef: true,
          purchaseDate: true,
          totalAmount: true,
          supplierPayments: {
            where: { status: RecordStatus.ACTIVE },
            select: { amount: true },
          },
        },
      }),
      this.prisma.supplierPayment.findMany({
        where: { shopId, supplierId, status: RecordStatus.ACTIVE },
        select: { purchaseId: true, amount: true },
      }),
    ]);

    let totalPurchases = 0n;
    let totalPaid = 0n;
    let paidOnOpening = 0n;
    for (const p of purchases) totalPurchases += p.totalAmount;
    for (const pay of payments) {
      totalPaid += pay.amount;
      if (pay.purchaseId === null) paidOnOpening += pay.amount;
    }

    const openingRemaining = supplier.openingBalance - paidOnOpening;
    const unpaid: UnpaidPurchaseDto[] = purchases
      .map((p) => {
        const paidOnBill = p.supplierPayments.reduce(
          (sum, pay) => sum + pay.amount,
          0n,
        );
        return {
          id: p.id,
          purchaseNo: p.purchaseNo,
          supplierInvoiceRef: p.supplierInvoiceRef,
          purchaseDate: p.purchaseDate.toISOString().slice(0, 10),
          totalAmount: Number(p.totalAmount),
          paidAmount: Number(paidOnBill),
          remaining: Number(p.totalAmount - paidOnBill),
        };
      })
      .filter((p) => p.remaining > 0);

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      openingBalance: Number(supplier.openingBalance),
      openingRemaining: Number(openingRemaining),
      totalPurchases: Number(totalPurchases),
      totalPaid: Number(totalPaid),
      payable: Number(supplier.openingBalance + totalPurchases - totalPaid),
      unpaidPurchases: unpaid,
    };
  }
}
