import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CashDirection,
  CashMovementType,
  ReferenceType,
  UnitStatus,
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
import { resolveTransactionDate } from '../../helpers/date.helper.js';
import {
  isUniqueConstraintViolation,
  violatedColumn,
} from '../../helpers/prisma-error-helper.js';
import {
  PURCHASE_INCLUDE,
  mapPurchaseToResponse,
} from '../helpers/purchase.mapper.js';
import {
  buildPurchaseListWhere,
  buildPurchaseMoneyFilterSql,
  buildPurchaseMoneyOrderedIdsSql,
  purchaseListNeedsMoneyJoin,
} from '../helpers/purchase-list-where.helper.js';
import { PurchasesWriteService } from './purchases-write.service.js';
import { PurchasesCancelService } from './purchases-cancel.service.js';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';

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
    private readonly storefrontRevalidate: StorefrontRevalidateService,
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
            const purchaseMoment = resolveTransactionDate(dto.purchaseDate);
            await tx.supplierPayment.create({
              data: {
                shopId,
                supplierId: dto.supplierId,
                purchaseId: purchase.id,
                amount: paidNow,
                paymentDate: purchaseMoment,
                clientRequestId: dto.clientRequestId,
                createdById: userId,
              },
            });
            await tx.cashMovement.create({
              data: {
                shopId,
                type: CashMovementType.SUPPLIER_PAYMENT,
                direction: CashDirection.OUT,
                amount: paidNow,
                movementDate: purchaseMoment,
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
      this.storefrontRevalidate.invalidateShopById(shopId);
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
        (violatedColumn(error, 'imei1') || violatedColumn(error, 'imei2'))
      ) {
        const allImeis = [
          ...new Set(
            dto.items.flatMap((line) =>
              (line.phoneUnits ?? []).flatMap((u) => [u.imei1, u.imei2]),
            ),
          ),
        ];
        const inUse = await this.prisma.inventoryUnit.findFirst({
          where: {
            shopId,
            status: { not: UnitStatus.VOIDED },
            OR: [{ imei1: { in: allImeis } }, { imei2: { in: allImeis } }],
          },
          select: { imei1: true, imei2: true },
        });
        const hit =
          allImeis.find((v) => v === inUse?.imei1 || v === inUse?.imei2) ??
          allImeis[0] ??
          'that IMEI';
        throw new BadRequestException(duplicateImei(hit));
      }
      throw error;
    }
  }

  async cancelPurchase(
    id: string,
    dto: CancelPurchaseDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const result = await this.cancelFlow.cancelPurchase(
      id,
      dto,
      shopId,
      userId,
    );
    this.storefrontRevalidate.invalidateShopById(shopId);
    return result;
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

    let where = buildPurchaseListWhere(query, shopId);
    const moneySort =
      sortBy === 'paid' || sortBy === 'outstanding' ? sortBy : null;

    if (purchaseListNeedsMoneyJoin(query)) {
      const matched = await this.prisma.$queryRaw<Array<{ id: string }>>(
        moneySort
          ? buildPurchaseMoneyOrderedIdsSql(query, shopId, moneySort, sortOrder)
          : buildPurchaseMoneyFilterSql(query, shopId),
      );
      const orderedIds = matched.map((row) => row.id);
      where = { shopId, id: { in: orderedIds } };

      if (moneySort) {
        const total = orderedIds.length;
        const pageIds = orderedIds.slice(
          getSkipNumber(page, pageSize),
          getSkipNumber(page, pageSize) + pageSize,
        );
        if (pageIds.length === 0) {
          return new PaginatedResponseDTO<ResponsePurchaseDto>(
            [],
            total,
            page,
            pageSize,
          );
        }
        const rows = await this.prisma.purchase.findMany({
          where: { shopId, id: { in: pageIds } },
          include: PURCHASE_INCLUDE,
        });
        const byId = new Map(rows.map((row) => [row.id, row]));
        return new PaginatedResponseDTO<ResponsePurchaseDto>(
          pageIds
            .map((id) => byId.get(id))
            .filter((row): row is NonNullable<typeof row> => row != null)
            .map((row) => mapPurchaseToResponse(row)),
          total,
          page,
          pageSize,
        );
      }
    }

    const prismaSortBy =
      sortBy === 'paid' || sortBy === 'outstanding' ? 'purchaseDate' : sortBy;

    const [rows, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [prismaSortBy]: sortOrder },
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
