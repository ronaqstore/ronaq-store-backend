import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  InventoryMovementType,
  ReferenceType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { CreateInventoryAdjustmentDto } from '../dto/create-inventory-adjustment.dto.js';
import {
  countedQuantityRequired,
  duplicateImei,
  insufficientStock,
  quantityRequired,
  resourceNotFound,
  unitNotDamagedOrLost,
  unitNotInStock,
} from '../../errors/error.builder.js';
import type {
  InventoryAdjustmentOutcome,
  InventoryProductRef,
} from './inventory.service.types.js';
import { assertInventoryAdjustmentShape } from '../helpers/inventory-adjustment-shape.helper.js';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';
import { assertImeiNotInStock } from '../../helpers/inventory-imei.helper.js';
import { isImeiUniqueViolation } from '../../helpers/prisma-error-helper.js';

const CREATED = 'Stock change recorded successfully';
const NO_CHANGE = 'Counted matches the system — no change recorded';

@Injectable()
export class InventoryAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storefrontRevalidate: StorefrontRevalidateService,
  ) {}

  async createAdjustment(
    dto: CreateInventoryAdjustmentDto,
    shopId: string,
  ): Promise<InventoryAdjustmentOutcome> {
    if (dto.clientRequestId) {
      const existing = await this.prisma.inventoryMovement.findFirst({
        where: {
          shopId,
          referenceType: ReferenceType.MANUAL,
          referenceId: dto.clientRequestId,
        },
        select: { id: true },
      });
      if (existing) {
        return { kind: 'created', message: CREATED };
      }
    }

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
        dto.clientRequestId,
      );
    } else if (dto.type === 'RESTORE') {
      outcome = await this.restorePhone(product, dto, shopId);
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
        dto.clientRequestId,
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
    clientRequestId?: string,
  ): Promise<InventoryAdjustmentOutcome> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      if (clientRequestId) {
        const existingInTx = await tx.inventoryMovement.findFirst({
          where: {
            shopId,
            referenceType: ReferenceType.MANUAL,
            referenceId: clientRequestId,
          },
          select: { id: true },
        });
        if (existingInTx) return { kind: 'created' as const };
      }

      const rows = await tx.$queryRaw<Array<{ quantity_on_hand: number }>>`
        SELECT quantity_on_hand FROM stock_levels
        WHERE product_id = ${product.id} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      const currentQty = rows[0]?.quantity_on_hand ?? 0;
      const delta = countedQuantity - currentQty;
      if (delta === 0) return { kind: 'nochange' as const };

      if (rows.length > 0) {
        const updatedStock = await tx.$queryRaw<Array<{ product_id: string }>>`
          UPDATE stock_levels
          SET quantity_on_hand = ${countedQuantity}, updated_at = now()
          WHERE product_id = ${product.id}::uuid
            AND shop_id = ${shopId}::uuid
            AND quantity_on_hand = ${currentQty}
          RETURNING product_id
        `;
        if (!updatedStock?.length) {
          throw new BadRequestException(
            'Stock level changed concurrently during adjustment',
          );
        }
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
          referenceType: clientRequestId ? ReferenceType.MANUAL : undefined,
          referenceId: clientRequestId ?? undefined,
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
    clientRequestId?: string,
  ): Promise<InventoryAdjustmentOutcome> {
    await this.prisma.$transaction(async (tx) => {
      if (clientRequestId) {
        const existingInTx = await tx.inventoryMovement.findFirst({
          where: {
            shopId,
            referenceType: ReferenceType.MANUAL,
            referenceId: clientRequestId,
          },
          select: { id: true },
        });
        if (existingInTx) return { kind: 'created' as const };
      }

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
          referenceType: clientRequestId ? ReferenceType.MANUAL : undefined,
          referenceId: clientRequestId ?? undefined,
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
      if (dto.clientRequestId) {
        const existingInTx = await tx.inventoryMovement.findFirst({
          where: {
            shopId,
            referenceType: ReferenceType.MANUAL,
            referenceId: dto.clientRequestId,
          },
          select: { id: true },
        });
        if (existingInTx) return { kind: 'created' as const };
      }

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
      const updatedUnits = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE inventory_units
        SET status = ${status}::"UnitStatus", updated_at = now()
        WHERE id = ${unit.id}::uuid
          AND shop_id = ${shopId}::uuid
          AND status = ${UnitStatus.IN_STOCK}::"UnitStatus"
        RETURNING id
      `;
      if (!updatedUnits?.length) {
        throw new BadRequestException(
          unitNotInStock(product.name, unit.imei1, unit.status),
        );
      }
      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: product.id,
          inventoryUnitId: unit.id,
          type:
            dto.type === 'LOST'
              ? InventoryMovementType.LOST
              : InventoryMovementType.DAMAGED,
          quantityChange: -1,
          reason: dto.reason,
          referenceType: dto.clientRequestId ? ReferenceType.MANUAL : undefined,
          referenceId: dto.clientRequestId ?? undefined,
        },
      });
      return { kind: 'created' as const };
    });

    return { kind: 'created', message: CREATED };
  }

  private async restorePhone(
    product: InventoryProductRef,
    dto: CreateInventoryAdjustmentDto,
    shopId: string,
  ): Promise<InventoryAdjustmentOutcome> {
    await this.prisma.$transaction(async (tx) => {
      if (dto.clientRequestId) {
        const existingInTx = await tx.inventoryMovement.findFirst({
          where: {
            shopId,
            referenceType: ReferenceType.MANUAL,
            referenceId: dto.clientRequestId,
          },
          select: { id: true },
        });
        if (existingInTx) return { kind: 'created' as const };
      }

      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          imei1: string;
          imei2: string | null;
        }>
      >`
        SELECT id, status, imei1, imei2 FROM inventory_units
        WHERE id = ${dto.inventoryUnitId}::uuid AND shop_id = ${shopId}::uuid
          AND product_id = ${product.id}::uuid
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(
          resourceNotFound('Inventory unit', dto.inventoryUnitId),
        );
      }
      const unit = locked[0];
      if (
        unit.status !== UnitStatus.DAMAGED &&
        unit.status !== UnitStatus.LOST
      ) {
        throw new BadRequestException(
          unitNotDamagedOrLost(product.name, unit.imei1, unit.status),
        );
      }

      await assertImeiNotInStock(tx, shopId, unit.id, unit.imei1, unit.imei2);

      try {
        const updatedUnits = await tx.$queryRaw<Array<{ id: string }>>`
          UPDATE inventory_units
          SET status = 'IN_STOCK'::"UnitStatus", updated_at = now()
          WHERE id = ${unit.id}::uuid
            AND shop_id = ${shopId}::uuid
            AND status IN ('DAMAGED'::"UnitStatus", 'LOST'::"UnitStatus")
          RETURNING id
        `;
        if (!updatedUnits?.length) {
          throw new BadRequestException(
            unitNotDamagedOrLost(product.name, unit.imei1, unit.status),
          );
        }
      } catch (error) {
        if (isImeiUniqueViolation(error)) {
          throw new BadRequestException(duplicateImei(unit.imei1));
        }
        throw error;
      }

      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: product.id,
          inventoryUnitId: unit.id,
          type: InventoryMovementType.ADJUSTMENT,
          quantityChange: 1,
          reason: dto.reason,
          referenceType: ReferenceType.MANUAL,
          referenceId: dto.clientRequestId ?? unit.id,
        },
      });
      return { kind: 'created' as const };
    });

    this.storefrontRevalidate.invalidateShopById(shopId);

    return { kind: 'created', message: CREATED };
  }
}
