import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
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
  adjustmentNotAllowedForSerialized,
  countedQuantityRequired,
  insufficientStock,
  quantityRequired,
  resourceNotFound,
  unitIdRequired,
  unitNotInStock,
  unwantedAdjustmentField,
} from '../../errors/error.builder.js';
import type {
  InventoryAdjustmentProductShape,
  InventoryProductRef,
} from './inventory.service.types.js';

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
  constructor(private readonly prisma: PrismaService) {}

  async listUnits(
    query: InventoryUnitQueryFilterDto,
    shopId: string,
  ): Promise<ResponseInventoryUnitDto[]> {
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

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { imei1: { contains: term, mode: 'insensitive' } },
        { imei2: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.condition) {
      where.condition = query.condition;
    }

    if (query.batteryMin != null) {
      where.batteryHealth = { gte: query.batteryMin };
    }

    const rows = await this.prisma.inventoryUnit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
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
          orderBy: { id: 'desc' },
        },
      },
    });

    return rows.map((row) => {
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
  }

  async listInStockUnits(
    productId: string,
    shopId: string,
  ): Promise<ResponseInventoryUnitDto[]> {
    return this.listUnits({ productId, status: UnitStatus.IN_STOCK }, shopId);
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

    this.assertShape(product, dto);

    if (dto.type === 'ADJUSTMENT') {
      const countedQuantity = dto.countedQuantity;
      if (countedQuantity === undefined) {
        throw new BadRequestException(countedQuantityRequired(product.name));
      }
      return this.adjustStock(product, countedQuantity, dto.reason, shopId);
    }
    if (product.trackingType === 'SERIALIZED') {
      return this.damagePhone(product, dto, shopId);
    }
    const quantity = dto.quantity;
    if (quantity === undefined) {
      throw new BadRequestException(quantityRequired(product.name));
    }
    return this.damageQuantity(product, quantity, dto.type, dto.reason, shopId);
  }

  private assertShape(
    product: InventoryAdjustmentProductShape,
    dto: CreateInventoryAdjustmentDto,
  ): void {
    if (dto.type === 'ADJUSTMENT') {
      if (product.trackingType === 'SERIALIZED') {
        throw new BadRequestException(
          adjustmentNotAllowedForSerialized(product.name),
        );
      }
      if (dto.countedQuantity === undefined) {
        throw new BadRequestException(countedQuantityRequired(product.name));
      }
      if (dto.quantity !== undefined) {
        throw new BadRequestException(
          unwantedAdjustmentField(product.name, 'ADJUSTMENT', 'quantity'),
        );
      }
      if (dto.inventoryUnitId !== undefined) {
        throw new BadRequestException(
          unwantedAdjustmentField(
            product.name,
            'ADJUSTMENT',
            'inventoryUnitId',
          ),
        );
      }
      return;
    }

    if (product.trackingType === 'SERIALIZED') {
      if (dto.inventoryUnitId === undefined) {
        throw new BadRequestException(unitIdRequired(product.name));
      }
      if (dto.quantity !== undefined) {
        throw new BadRequestException(
          unwantedAdjustmentField(product.name, dto.type, 'quantity'),
        );
      }
      if (dto.countedQuantity !== undefined) {
        throw new BadRequestException(
          unwantedAdjustmentField(product.name, dto.type, 'countedQuantity'),
        );
      }
      return;
    }

    if (dto.quantity === undefined) {
      throw new BadRequestException(quantityRequired(product.name));
    }
    if (dto.countedQuantity !== undefined) {
      throw new BadRequestException(
        unwantedAdjustmentField(product.name, dto.type, 'countedQuantity'),
      );
    }
    if (dto.inventoryUnitId !== undefined) {
      throw new BadRequestException(
        unwantedAdjustmentField(product.name, dto.type, 'inventoryUnitId'),
      );
    }
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

    where.type = query.type ?? { in: MANUAL_TYPES };
    if (query.productId) where.productId = query.productId;

    const dateFilters: Prisma.InventoryMovementWhereInput[] = [];
    if (query.from)
      dateFilters.push({ createdAt: { gte: new Date(query.from) } });
    if (query.to) dateFilters.push({ createdAt: { lte: new Date(query.to) } });
    if (dateFilters.length > 0) where.AND = dateFilters;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { product: { name: { contains: term, mode: 'insensitive' } } },
        { reason: { contains: term, mode: 'insensitive' } },
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
