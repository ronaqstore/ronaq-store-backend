import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  CashDirection,
  CashMovementType,
  PaymentMethod,
  RecordStatus,
  ReferenceType,
} from '../../generated/prisma/enums.js';
import { CreatePaymentDto } from '../dto/create-payment.dto.js';
import { CancelPaymentDto } from '../dto/cancel-payment.dto.js';
import { PaymentQueryFilterDto } from '../dto/payment-query.filter.js';
import { ResponsePaymentDto } from '../dto/response-payment.dto.js';
import {
  CustomerReceivableDto,
  UnpaidSaleDto,
} from '../dto/response-customer-receivable.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { CancelImpactResponseDto } from '../../common-dto/response/cancel-impact.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { lockShopForUpdate } from '../../helpers/shop-lock.helper.js';
import {
  duplicateFieldValue,
  paymentExceedsOutstanding,
  resourceNotFound,
} from '../../errors/error.builder.js';
import {
  isUniqueConstraintViolation,
  uniqueViolationColumns,
} from '../../helpers/prisma-error-helper.js';
import { PaymentsAllocationService } from './payments-allocation.service.js';
import { PaymentsCancelService } from './payments-cancel.service.js';

const PAYMENT_INCLUDE = {
  customer: { select: { name: true } },
  sale: { select: { saleNo: true } },
} satisfies Prisma.PaymentInclude;

type PaymentWithRefs = Prisma.PaymentGetPayload<{
  include: typeof PAYMENT_INCLUDE;
}>;

const CREATED = 'Payment recorded successfully';
const ALREADY_SAVED = 'Payment already saved';

export type CancelPaymentResult =
  StatusBaseResponseDTO | PurchaseOverdraftResponseDto;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocation: PaymentsAllocationService,
    private readonly cancelService: PaymentsCancelService,
  ) {}

  async createPayment(
    dto: CreatePaymentDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const existing = await this.prisma.payment.findFirst({
      where: { shopId, clientRequestId: dto.clientRequestId },
      select: { id: true },
    });
    if (existing) {
      return new StatusBaseResponseDTO(true, ALREADY_SAVED);
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, shopId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException(resourceNotFound('Customer', dto.customerId));
    }

    let explicitIds: string[] | null = null;
    if (dto.salesIds !== undefined) {
      const seen = new Set<string>();
      for (const id of dto.salesIds) {
        if (seen.has(id)) {
          throw new BadRequestException(
            duplicateFieldValue('Payment', 'saleId', id),
          );
        }
        seen.add(id);
      }

      const sales = await this.prisma.sale.findMany({
        where: {
          id: { in: dto.salesIds },
          shopId,
          customerId: dto.customerId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (sales.length !== dto.salesIds.length) {
        const found = new Set(sales.map((sale) => sale.id));
        const missing = dto.salesIds.find((id) => !found.has(id));
        if (missing) {
          throw new NotFoundException(resourceNotFound('Sale', missing));
        }
      }
      explicitIds = dto.salesIds;
    }

    const amount = BigInt(dto.amount);
    const paymentMoment = new Date(dto.paymentDate);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockShopForUpdate(tx, shopId);

        const lockedCustomer = await tx.$queryRaw<
          Array<{ name: string; opening_balance: bigint | string }>
        >`
          SELECT name, opening_balance FROM customers
          WHERE id = ${dto.customerId} AND shop_id = ${shopId}
          FOR UPDATE
        `;
        if (!lockedCustomer?.length) {
          throw new NotFoundException(
            resourceNotFound('Customer', dto.customerId),
          );
        }
        const customerName = lockedCustomer[0].name;
        const openingBalance = BigInt(lockedCustomer[0].opening_balance);

        const replayed = await tx.payment.findFirst({
          where: { shopId, clientRequestId: dto.clientRequestId },
          select: { id: true },
        });
        if (replayed) {
          return new StatusBaseResponseDTO(true, ALREADY_SAVED);
        }

        const candidates = explicitIds
          ? await this.allocation.lockExplicitSales(
              tx,
              explicitIds,
              shopId,
              dto.customerId,
            )
          : await this.allocation.lockOpenSales(tx, shopId, dto.customerId);

        const paidRows = await tx.$queryRaw<
          Array<{ sale_id: string | null; total: bigint | string }>
        >`
          SELECT sale_id, SUM(amount) AS total FROM payments
          WHERE shop_id = ${shopId} AND customer_id = ${dto.customerId}
            AND status = 'ACTIVE'
          GROUP BY sale_id
        `;
        const paidBySale = new Map<string, bigint>();
        let paidOpening = 0n;
        for (const row of paidRows ?? []) {
          const total = BigInt(row.total);
          if (row.sale_id) paidBySale.set(row.sale_id, total);
          else paidOpening = total;
        }
        const openingRemaining =
          openingBalance > paidOpening ? openingBalance - paidOpening : 0n;

        const candidateIds = candidates.map((sale) => sale.id);
        const returnedBySale = new Map<string, bigint>();
        const refundedBySale = new Map<string, bigint>();
        if (candidateIds.length > 0) {
          const returnRows = await tx.saleReturn.groupBy({
            by: ['saleId'],
            where: {
              shopId,
              saleId: { in: candidateIds },
              status: RecordStatus.ACTIVE,
            },
            _sum: { returnAmount: true },
          });
          for (const row of returnRows) {
            returnedBySale.set(row.saleId, row._sum.returnAmount ?? 0n);
          }
          const refundRows = await tx.refund.findMany({
            where: {
              shopId,
              saleReturn: {
                saleId: { in: candidateIds },
                status: RecordStatus.ACTIVE,
              },
            },
            select: {
              amount: true,
              saleReturn: { select: { saleId: true } },
            },
          });
          for (const row of refundRows) {
            const key = row.saleReturn.saleId;
            refundedBySale.set(
              key,
              (refundedBySale.get(key) ?? 0n) + row.amount,
            );
          }
        }

        let total = explicitIds ? 0n : openingRemaining;
        const outstanding = new Map<string, bigint>();
        for (const sale of candidates) {
          const leftRaw =
            sale.totalAmount -
            (returnedBySale.get(sale.id) ?? 0n) -
            (paidBySale.get(sale.id) ?? 0n) +
            (refundedBySale.get(sale.id) ?? 0n);

          const left = leftRaw > 0n ? leftRaw : 0n;
          outstanding.set(sale.id, left);
          total += left;
        }

        if (amount > total) {
          throw new BadRequestException(
            paymentExceedsOutstanding(
              customerName,
              Number(amount),
              Number(total),
            ),
          );
        }

        const portions: Array<{ saleId: string | null; amount: bigint }> = [];
        let left = amount;
        if (!explicitIds && left > 0n && openingRemaining > 0n) {
          const take = left < openingRemaining ? left : openingRemaining;
          portions.push({ saleId: null, amount: take });
          left -= take;
        }
        for (const sale of candidates) {
          if (left === 0n) break;
          const available = outstanding.get(sale.id) ?? 0n;
          if (available <= 0n) continue;
          const take = left < available ? left : available;
          portions.push({ saleId: sale.id, amount: take });
          left -= take;
        }

        const receiptGroupId = randomUUID();
        for (const portion of portions) {
          const payment = await tx.payment.create({
            data: {
              shopId,
              customerId: dto.customerId,
              saleId: portion.saleId,
              receiptGroupId,
              amount: portion.amount,
              paymentDate: paymentMoment,
              method: dto.method ?? PaymentMethod.CASH,
              clientRequestId: dto.clientRequestId,
              notes: dto.notes?.trim() ? dto.notes : null,
              createdById: userId,
            },
            select: { id: true },
          });
          await tx.cashMovement.create({
            data: {
              shopId,
              type: CashMovementType.CUSTOMER_PAYMENT,
              direction: CashDirection.IN,
              amount: portion.amount,
              movementDate: paymentMoment,
              referenceType: ReferenceType.PAYMENT,
              referenceId: payment.id,
              createdById: userId,
            },
          });
        }

        return new StatusBaseResponseDTO(true, CREATED);
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        const columns = uniqueViolationColumns(error);
        if (
          columns.length === 0 ||
          columns.includes('payments_idempotency_uq') ||
          columns.includes('client_request_id')
        ) {
          return new StatusBaseResponseDTO(true, ALREADY_SAVED);
        }
      }
      throw error;
    }
  }

  cancelPayment(
    id: string,
    dto: CancelPaymentDto,
    shopId: string,
    userId: string,
  ): Promise<CancelPaymentResult> {
    return this.cancelService.cancelPayment(id, dto, shopId, userId);
  }

  getCancelImpact(
    id: string,
    shopId: string,
  ): Promise<CancelImpactResponseDto> {
    return this.cancelService.getCancelImpact(id, shopId);
  }

  async getPayments(
    query: PaymentQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponsePaymentDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'paymentDate';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.PaymentWhereInput = { shopId };
    if (query.customerId) where.customerId = query.customerId;
    if (query.saleId) where.saleId = query.saleId;
    if (query.receiptGroupId) where.receiptGroupId = query.receiptGroupId;
    if (query.status) where.status = query.status;
    const dateFilters: Prisma.PaymentWhereInput[] = [];
    if (query.from)
      dateFilters.push({ paymentDate: { gte: new Date(query.from) } });
    if (query.to)
      dateFilters.push({ paymentDate: { lte: new Date(query.to) } });
    if (dateFilters.length > 0) where.AND = dateFilters;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { customer: { name: { contains: term, mode: 'insensitive' } } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    const orderBy =
      sortBy === 'customerName'
        ? ({ customer: { name: sortOrder } } as const)
        : ({ [sortBy]: sortOrder } as const);

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy,
        include: PAYMENT_INCLUDE,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponsePaymentDto>(
      rows.map((row) => this.toResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getPaymentById(
    id: string,
    shopId: string,
  ): Promise<ResponsePaymentDto> {
    const row = await this.prisma.payment.findFirst({
      where: { id, shopId },
      include: PAYMENT_INCLUDE,
    });
    if (!row) throw new NotFoundException(resourceNotFound('Payment', id));
    return this.toResponse(row);
  }

  async getCustomerReceivable(
    customerId: string,
    shopId: string,
  ): Promise<CustomerReceivableDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, shopId },
      select: { id: true, name: true, openingBalance: true },
    });
    if (!customer) {
      throw new NotFoundException(resourceNotFound('Customer', customerId));
    }

    const [sales, payments, returns, refundRows] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          shopId,
          customerId,
          status: RecordStatus.ACTIVE,
        },
        orderBy: [{ saleDate: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          saleNo: true,
          saleDate: true,
          totalAmount: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { shopId, customerId, status: RecordStatus.ACTIVE },
        select: { saleId: true, amount: true },
      }),
      this.prisma.saleReturn.groupBy({
        by: ['saleId'],
        where: {
          shopId,
          customerId,
          status: RecordStatus.ACTIVE,
        },
        _sum: { returnAmount: true },
      }),
      this.prisma.refund.findMany({
        where: {
          shopId,
          saleReturn: {
            customerId,
            status: RecordStatus.ACTIVE,
          },
        },
        select: {
          amount: true,
          saleReturn: { select: { saleId: true } },
        },
      }),
    ]);

    let totalSales = 0n;
    let totalPaid = 0n;
    let paidOnOpening = 0n;
    const paidBySale = new Map<string, bigint>();
    for (const sale of sales) totalSales += sale.totalAmount;
    for (const pay of payments) {
      totalPaid += pay.amount;
      if (pay.saleId === null) paidOnOpening += pay.amount;
      else {
        paidBySale.set(
          pay.saleId,
          (paidBySale.get(pay.saleId) ?? 0n) + pay.amount,
        );
      }
    }

    const returnedBySale = new Map<string, bigint>();
    for (const row of returns) {
      returnedBySale.set(row.saleId, row._sum.returnAmount ?? 0n);
    }
    const refundedBySale = new Map<string, bigint>();
    let totalRefunds = 0n;
    for (const row of refundRows) {
      totalRefunds += row.amount;
      const saleId = row.saleReturn.saleId;
      refundedBySale.set(
        saleId,
        (refundedBySale.get(saleId) ?? 0n) + row.amount,
      );
    }

    let totalReturns = 0n;
    for (const amount of returnedBySale.values()) totalReturns += amount;

    const openingRemainingRaw = customer.openingBalance - paidOnOpening;
    const openingRemaining =
      openingRemainingRaw > 0n ? openingRemainingRaw : 0n;

    const unpaidSales: UnpaidSaleDto[] = sales
      .map((sale) => {
        const paidAmount = paidBySale.get(sale.id) ?? 0n;
        const remainingRaw =
          sale.totalAmount -
          (returnedBySale.get(sale.id) ?? 0n) -
          paidAmount +
          (refundedBySale.get(sale.id) ?? 0n);
        const remaining = remainingRaw > 0n ? remainingRaw : 0n;
        return {
          id: sale.id,
          saleNo: sale.saleNo,
          saleDate:
            sale.saleDate instanceof Date
              ? sale.saleDate.toISOString().slice(0, 10)
              : String(sale.saleDate).slice(0, 10),
          totalAmount: Number(sale.totalAmount),
          paidAmount: Number(paidAmount),
          remaining: Number(remaining),
        };
      })
      .filter((sale) => sale.remaining > 0);

    const receivable =
      customer.openingBalance +
      totalSales -
      totalPaid -
      totalReturns +
      totalRefunds;

    return {
      customerId: customer.id,
      customerName: customer.name,
      openingBalance: Number(customer.openingBalance),
      openingRemaining: Number(openingRemaining),
      totalSales: Number(totalSales),
      totalPaid: Number(totalPaid),
      receivable: Number(receivable > 0n ? receivable : 0n),
      unpaidSales,
    };
  }

  private toResponse(row: PaymentWithRefs): ResponsePaymentDto {
    return {
      id: row.id,
      shopId: row.shopId,
      customerId: row.customerId,
      customerName: row.customer?.name,
      saleId: row.saleId,
      saleNo: row.sale?.saleNo ?? null,
      receiptGroupId: row.receiptGroupId,
      amount: Number(row.amount),
      paymentDate: row.paymentDate,
      method: row.method,
      status: row.status,
      cancelledAt: row.cancelledAt,
      cancelReason: row.cancelReason,
      cancelledById: row.cancelledById,
      clientRequestId: row.clientRequestId,
      notes: row.notes,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
