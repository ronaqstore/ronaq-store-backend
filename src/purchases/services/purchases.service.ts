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
} from '../../generated/prisma/enums.js';
import { CreatePurchaseDto } from '../dto/create-purchase.dto.js';
import { CancelPurchaseDto } from '../dto/cancel-purchase.dto.js';
import { PurchaseQueryFilterDto } from '../dto/purchase-query.filter.js';
import { ResponsePurchaseDto } from '../dto/response-purchase.dto.js';
import { PurchaseOverdraftResponseDto } from '../dto/overdraft-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { CancelImpactResponseDto } from '../../common-dto/response/cancel-impact.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { aggregateCurrentCash } from '../../helpers/cash-balance.helper.js';
import {
  duplicateImei,
  openingStockCannotTakePayment,
  purchasePaidExceedsTotal,
  resourceNotFound,
} from '../../errors/error.builder.js';
import {
  isUniqueConstraintViolation,
  violatedColumn,
} from '../../helpers/prisma-error-helper.js';
import {
  PURCHASE_INCLUDE,
  mapPurchaseToResponse,
} from '../helpers/purchase.mapper.js';
import { PurchasesWriteService } from './purchases-write.service.js';
import { PurchasesCancelService } from './purchases-cancel.service.js';

export type CreatePurchaseResult =
  StatusBaseResponseDTO | PurchaseOverdraftResponseDto;

const CREATED = 'Purchase created successfully';
const ALREADY_SAVED = 'Purchase already saved';

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly writeFlow: PurchasesWriteService,
    private readonly cancelFlow: PurchasesCancelService,
  ) {}

  async createPurchase(
    dto: CreatePurchaseDto,
    shopId: string,
    userId: string,
  ): Promise<CreatePurchaseResult> {
    const existing = await this.prisma.purchase.findFirst({
      where: { shopId, clientRequestId: dto.clientRequestId },
      select: { id: true },
    });
    if (existing) {
      return new StatusBaseResponseDTO(true, ALREADY_SAVED);
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, shopId },
      select: { id: true },
    });
    if (!supplier) {
      throw new NotFoundException(resourceNotFound('Supplier', dto.supplierId));
    }

    const items = await this.writeFlow.validateLines(dto, shopId);

    const totalAmount = items.reduce(
      (sum, line) => sum + BigInt(line.quantity) * BigInt(line.unitCost),
      0n,
    );
    const paidNow = BigInt(dto.paidNow ?? 0);

    if (dto.isOpeningStock && paidNow > 0n) {
      throw new BadRequestException(openingStockCannotTakePayment());
    }
    if (!dto.isOpeningStock && paidNow > totalAmount) {
      throw new BadRequestException(
        purchasePaidExceedsTotal(Number(totalAmount), Number(paidNow)),
      );
    }

    try {
      const outcome = await this.prisma.$transaction(
        async (tx) => {
          const shop = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE
        `;
          if (!shop?.length) {
            throw new NotFoundException(resourceNotFound('Shop', shopId));
          }

          let overdraft = false;
          if (paidNow > 0n) {
            const after =
              (await aggregateCurrentCash(tx, shopId)) - Number(paidNow);
            if (after < 0) {
              if (!dto.confirmOverdraft) {
                return { kind: 'overdraft' as const, shortfall: -after };
              }
              overdraft = true;
            }
          }

          const purchase = await this.writeFlow.insertPurchase(
            tx,
            dto,
            shopId,
            userId,
            totalAmount,
          );

          for (const line of items) {
            const purchaseItem = await tx.purchaseItem.create({
              data: {
                shopId,
                purchaseId: purchase.id,
                productId: line.productId,
                quantity: line.quantity,
                unitCost: BigInt(line.unitCost),
                totalCost: BigInt(line.quantity) * BigInt(line.unitCost),
              },
            });
            await this.writeFlow.applyStock(
              tx,
              shopId,
              purchase.id,
              purchaseItem.id,
              line,
            );
          }

          if (paidNow > 0n) {
            await tx.supplierPayment.create({
              data: {
                shopId,
                supplierId: dto.supplierId,
                purchaseId: purchase.id,
                amount: paidNow,
                paymentDate: new Date(dto.purchaseDate),
                createdById: userId,
              },
            });
            await tx.cashMovement.create({
              data: {
                shopId,
                type: CashMovementType.SUPPLIER_PAYMENT,
                direction: CashDirection.OUT,
                amount: paidNow,
                movementDate: new Date(dto.purchaseDate),
                referenceType: ReferenceType.PURCHASE,
                referenceId: purchase.id,
                isOverdraft: overdraft,
                createdById: userId,
              },
            });
          }

          return { kind: 'created' as const };
        },
        { maxWait: 20_000, timeout: 180_000 },
      );

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
      if (
        isUniqueConstraintViolation(error) &&
        violatedColumn(error, 'imei1')
      ) {
        const allImeis = [
          ...new Set(dto.items.flatMap((line) => line.imeis ?? [])),
        ];
        const inUse = await this.prisma.inventoryUnit.findFirst({
          where: { shopId, imei1: { in: allImeis } },
          select: { imei1: true },
        });
        throw new BadRequestException(
          duplicateImei(inUse?.imei1 ?? allImeis[0] ?? 'that IMEI'),
        );
      }
      throw error;
    }
  }

  cancelPurchase(
    id: string,
    dto: CancelPurchaseDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    return this.cancelFlow.cancelPurchase(id, dto, shopId, userId);
  }

  getCancelImpact(
    id: string,
    shopId: string,
  ): Promise<CancelImpactResponseDto> {
    return this.cancelFlow.getCancelImpact(id, shopId);
  }

  async getPurchases(
    query: PurchaseQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponsePurchaseDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'purchaseDate';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.PurchaseWhereInput = { shopId };
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;
    if (query.isOpeningStock !== undefined && query.isOpeningStock !== null) {
      where.isOpeningStock = query.isOpeningStock;
    }
    const dateFilters: Prisma.PurchaseWhereInput[] = [];
    if (query.from)
      dateFilters.push({ purchaseDate: { gte: new Date(query.from) } });
    if (query.to)
      dateFilters.push({ purchaseDate: { lte: new Date(query.to) } });
    if (dateFilters.length > 0) where.AND = dateFilters;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { purchaseNo: { contains: term, mode: 'insensitive' } },
        { supplierInvoiceRef: { contains: term, mode: 'insensitive' } },
        { supplier: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: PURCHASE_INCLUDE,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponsePurchaseDto>(
      rows.map((row) => mapPurchaseToResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getPurchaseById(
    id: string,
    shopId: string,
  ): Promise<ResponsePurchaseDto> {
    const row = await this.prisma.purchase.findFirst({
      where: { id, shopId },
      include: PURCHASE_INCLUDE,
    });
    if (!row) throw new NotFoundException(resourceNotFound('Purchase', id));
    return mapPurchaseToResponse(row);
  }
}
