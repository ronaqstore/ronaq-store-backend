import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { buildTokenizedSearchAnd } from '../../helpers/tokenized-search.helper.js';
import {
  InventoryMovementType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { InventoryUnitQueryFilterDto } from '../dto/inventory-unit-query.filter.js';
import { CreateInventoryAdjustmentDto } from '../dto/create-inventory-adjustment.dto.js';
import { InventoryAdjustmentQueryFilterDto } from '../dto/inventory-adjustment-query.filter.js';
import { ResponseInventoryMovementDto } from '../dto/response-inventory-movement.dto.js';
import { ResponseInventoryUnitDto } from '../dto/response-inventory-unit.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  countedQuantityRequired,
  insufficientStock,
  quantityRequired,
  resourceNotFound,
  unitNotInStock,
} from '../../errors/error.builder.js';
import type { InventoryProductRef } from './inventory.service.types.js';
import { assertInventoryAdjustmentShape } from '../helpers/inventory-adjustment-shape.helper.js';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';

const CREATED = 'Stock change recorded successfully';
const NO_CHANGE = 'Counted matches the system — no change recorded';

export type InventoryAdjustmentOutcome =
  { kind: 'created'; message: string } | { kind: 'nochange'; message: string };

const MOVEMENT_INCLUDE = {
  product: { select: { name: true } },
  inventoryUnit: { select: { imei1: true } },
} satisfies Prisma.InventoryMovementInclude;

type MovementWithRefs = Prisma.InventoryMovementGetPayload<{
  include: typeof MOVEMENT_INCLUDE;
}>;

const MANUAL_TYPES: InventoryMovementType[] = [
  InventoryMovementType.ADJUSTMENT,
  InventoryMovementType.DAMAGED,
  InventoryMovementType.LOST,
];

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storefrontRevalidate: StorefrontRevalidateService,
  ) {}

  async listUnits(
    query: InventoryUnitQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseInventoryUnitDto>> {
    const product = await this.prisma.product.findFirst({
      where: { id: query.productId, shopId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', query.productId));
    }

    const where: Prisma.InventoryUnitWhereInput = {
      shopId,
      productId: query.productId,
    };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as UnitStatus;
    } else if (!query.status) {
      where.status = UnitStatus.IN_STOCK;
    }

    const searchAnd = buildTokenizedSearchAnd<Prisma.InventoryUnitWhereInput>(
      query.search,
      (token) => [
        { imei1: { contains: token, mode: 'insensitive' } },
        { imei2: { contains: token, mode: 'insensitive' } },
      ],
    );
    if (searchAnd.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        ...searchAnd,
      ];
    }

    if (query.condition) {
      where.condition = query.condition;
    }

    if (query.batteryMin != null) {
      where.batteryHealth = { gte: query.batteryMin };
    }

    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const skip = getSkipNumber(page, pageSize);

    const include = {
      product: {
        select: {
          defaultSellingPrice: true,
          brand: { select: { name: true } },
        },
      },
      purchaseItem: {
        include: {
          purchase: {
            include: {
              supplier: {
                select: { name: true, phone: true },
              },
            },
          },
        },
      },
      saleItems: {
        include: {
          sale: {
            include: {
              customer: {
                select: { name: true, phone: true },
              },
            },
          },
        },
        take: 1,
        orderBy: { id: 'desc' as const },
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.inventoryUnit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include,
      }),
      this.prisma.inventoryUnit.count({ where }),
    ]);

    const items = rows.map((row) => {
      const purchase = row.purchaseItem?.purchase;
      const supplier = purchase?.supplier;
      const latestSaleItem = row.saleItems?.[0];
      const sale = latestSaleItem?.sale;
      const customer = sale?.customer;
      const defaultSell = Number(row.product.defaultSellingPrice);
      const asking = row.askingPrice != null ? Number(row.askingPrice) : null;

      return {
        id: row.id,
        productId: row.productId,
        imei1: row.imei1,
        imei2: row.imei2,
        condition: row.condition,
        status: row.status,
        unitCost: Number(row.unitCost),
        batteryHealth: row.batteryHealth,
        askingPrice: asking,
        defectNotes: row.defectNotes,
        effectivePrice: asking ?? defaultSell,
        createdAt: row.createdAt,
        purchaseNo: purchase?.purchaseNo ?? null,
        purchaseDate: purchase?.purchaseDate
          ? purchase.purchaseDate.toISOString().slice(0, 10)
          : null,
        supplierInvoiceRef: purchase?.supplierInvoiceRef ?? null,
        supplierName: supplier?.name ?? null,
        supplierPhone: supplier?.phone ?? null,
        saleNo: sale?.saleNo ?? null,
        saleDate: sale?.saleDate
          ? sale.saleDate.toISOString().slice(0, 10)
          : null,
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
        salePrice: latestSaleItem ? Number(latestSaleItem.unitPrice) : null,
      };
    });

    return new PaginatedResponseDTO(items, total, page, pageSize);
  }

  async listInStockUnits(
    productId: string,
    shopId: string,
  ): Promise<ResponseInventoryUnitDto[]> {
    const page = await this.listUnits(
      { productId, status: UnitStatus.IN_STOCK, page: 1, pageSize: 100 },
      shopId,
    );
    return page.items;
  }

  async createAdjustment(
    dto: CreateInventoryAdjustmentDto,
    shopId: string,
  ): Promise<InventoryAdjustmentOutcome> {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, shopId, isActive: true },
      select: { id: true, name: true, trackingType: true },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', dto.productId));
    }

    assertInventoryAdjustmentShape(product, dto);

    let outcome: InventoryAdjustmentOutcome;
    if (dto.type === 'ADJUSTMENT') {
      const countedQuantity = dto.countedQuantity;
      if (countedQuantity === undefined) {
        throw new BadRequestException(countedQuantityRequired(product.name));
      }
      outcome = await this.adjustStock(
        product,
        countedQuantity,
        dto.reason,
        shopId,
      );
    } else if (product.trackingType === 'SERIALIZED') {
      outcome = await this.damagePhone(product, dto, shopId);
    } else {
      const quantity = dto.quantity;
      if (quantity === undefined) {
        throw new BadRequestException(quantityRequired(product.name));
      }
      outcome = await this.damageQuantity(
        product,
        quantity,
        dto.type,
        dto.reason,
        shopId,
      );
    }
    if (outcome.kind === 'created') {
      this.storefrontRevalidate.invalidateShopById(shopId);
    }
    return outcome;
  }

  private async adjustStock(
    product: InventoryProductRef,
    countedQuantity: number,
    reason: string,
    shopId: string,
  ): Promise<InventoryAdjustmentOutcome> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ quantity_on_hand: number }>>`
        SELECT quantity_on_hand FROM stock_levels
        WHERE product_id = ${product.id} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      const currentQty = rows[0]?.quantity_on_hand ?? 0;
      const delta = countedQuantity - currentQty;
      if (delta === 0) return { kind: 'nochange' as const };

      if (rows.length > 0) {
        await tx.stockLevel.update({
          where: { productId: product.id },
          data: { quantityOnHand: countedQuantity },
        });
      } else {
        await tx.stockLevel.create({
          data: {
            productId: product.id,
            shopId,
            quantityOnHand: countedQuantity,
            avgUnitCost: 0n,
          },
        });
      }

      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: product.id,
          type: InventoryMovementType.ADJUSTMENT,
          quantityChange: delta,
          reason,
        },
      });
      return { kind: 'created' as const };
    });

    return outcome.kind === 'created'
      ? { kind: 'created', message: CREATED }
      : { kind: 'nochange', message: NO_CHANGE };
  }

  private async damageQuantity(
    product: InventoryProductRef,
    quantity: number,
    type: 'DAMAGED' | 'LOST',
    reason: string,
    shopId: string,
  ): Promise<InventoryAdjustmentOutcome> {
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.$executeRaw`
        UPDATE stock_levels
        SET quantity_on_hand = quantity_on_hand - ${quantity}, updated_at = now()
        WHERE product_id = ${product.id} AND shop_id = ${shopId}
          AND quantity_on_hand >= ${quantity}
      `;
      if (removed === 0) {
        const current = await tx.stockLevel.findUnique({
          where: { productId: product.id },
          select: { quantityOnHand: true },
        });
        throw new BadRequestException(
          insufficientStock(
            product.name,
            current?.quantityOnHand ?? 0,
            quantity,
          ),
        );
      }

      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: product.id,
          type,
          quantityChange: -quantity,
          reason,
        },
      });
      return { kind: 'created' as const };
    });

    return { kind: 'created', message: CREATED };
  }

  private async damagePhone(
    product: InventoryProductRef,
    dto: CreateInventoryAdjustmentDto,
    shopId: string,
  ): Promise<InventoryAdjustmentOutcome> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; imei1: string }>
      >`
        SELECT id, status, imei1 FROM inventory_units
        WHERE id = ${dto.inventoryUnitId} AND shop_id = ${shopId}
          AND product_id = ${product.id}
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(
          resourceNotFound('Inventory unit', dto.inventoryUnitId),
        );
      }
      const unit = locked[0];
      if (unit.status !== UnitStatus.IN_STOCK) {
        throw new BadRequestException(
          unitNotInStock(product.name, unit.imei1, unit.status),
        );
      }

      const status =
        dto.type === 'DAMAGED' ? UnitStatus.DAMAGED : UnitStatus.LOST;
      await tx.inventoryUnit.update({
        where: { id: unit.id },
        data: { status },
      });
      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: product.id,
          inventoryUnitId: unit.id,
          type: dto.type,
          quantityChange: -1,
          reason: dto.reason,
        },
      });
      return { kind: 'created' as const };
    });

    return { kind: 'created', message: CREATED };
  }

  async getInventoryMovements(
    query: InventoryAdjustmentQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseInventoryMovementDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.InventoryMovementWhereInput = { shopId };

    if (query.type) {
      where.type = query.type;
    } else if (query.scope !== 'all') {
      where.type = { in: MANUAL_TYPES };
    }
    if (query.productId) where.productId = query.productId;
    if (query.quantityChange !== undefined) {
      where.quantityChange = query.quantityChange;
    }

    const andFilters: Prisma.InventoryMovementWhereInput[] = [];
    if (query.from)
      andFilters.push({ createdAt: { gte: new Date(query.from) } });
    if (query.to) andFilters.push({ createdAt: { lte: new Date(query.to) } });

    if (query.reason?.trim()) {
      const words = query.reason.trim().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        andFilters.push({
          reason: { contains: words[0], mode: 'insensitive' },
        });
      } else if (words.length > 1) {
        andFilters.push({
          OR: words.map((word) => ({
            reason: { contains: word, mode: 'insensitive' as const },
          })),
        });
      }
    }

    if (andFilters.length > 0) where.AND = andFilters;

    const movementSearchAnd =
      buildTokenizedSearchAnd<Prisma.InventoryMovementWhereInput>(
        query.search,
        (token) => [
          { product: { name: { contains: token, mode: 'insensitive' } } },
          { reason: { contains: token, mode: 'insensitive' } },
        ],
      );
    if (movementSearchAnd.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        ...movementSearchAnd,
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: MOVEMENT_INCLUDE,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseInventoryMovementDto>(
      rows.map((row) => this.toResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  private toResponse(row: MovementWithRefs): ResponseInventoryMovementDto {
    return {
      id: row.id,
      shopId: row.shopId,
      productId: row.productId,
      productName: row.product.name,
      inventoryUnitId: row.inventoryUnitId,
      imei: row.inventoryUnit?.imei1 ?? null,
      type: row.type,
      quantityChange: row.quantityChange,
      reason: row.reason,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      createdAt: row.createdAt,
    };
  }
}
