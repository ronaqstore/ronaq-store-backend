import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  ConsignmentStatus,
  InventoryMovementType,
  ReferenceType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { assertImeiNotInStock } from '../../helpers/inventory-imei.helper.js';
import { isImeiUniqueViolation } from '../../helpers/prisma-error-helper.js';
import {
  resourceNotFound,
  saleCancelConsignmentSettled,
  saleCancelImeiAlreadyInStock,
  saleCancelUnitNotSold,
} from '../../errors/error.builder.js';

type Tx = Prisma.TransactionClient;

export async function restoreSaleCancelledUnit(
  tx: Tx,
  unitId: string,
  productId: string,
  shopId: string,
  saleNo: string,
  saleId: string,
  reason: string,
): Promise<void> {
  const locked = await tx.$queryRaw<
    Array<{
      id: string;
      status: string;
      imei1: string;
      imei2: string | null;
      consignment_id: string | null;
    }>
  >`
    SELECT id, status, imei1, imei2, consignment_id FROM inventory_units
    WHERE id = ${unitId} AND shop_id = ${shopId}
    FOR UPDATE
  `;
  if (!locked?.length) {
    throw new NotFoundException(resourceNotFound('Inventory unit', unitId));
  }
  const unit = locked[0];
  if (unit.status !== UnitStatus.SOLD) {
    throw new BadRequestException(
      saleCancelUnitNotSold(saleNo, unit.imei1, unit.status),
    );
  }

  if (unit.consignment_id) {
    const conRows = await tx.$queryRaw<
      Array<{ id: string; consignment_no: string; status: string }>
    >`
      SELECT id, consignment_no, status FROM consignments
      WHERE id = ${unit.consignment_id}::uuid
    `;
    const con = conRows?.[0];
    if (con) {
      if (con.status === ConsignmentStatus.SETTLED) {
        throw new BadRequestException(
          saleCancelConsignmentSettled(saleNo, con.consignment_no),
        );
      }
      await tx.$executeRaw`
        UPDATE consignments
        SET status = ${ConsignmentStatus.IN_CUSTODY}::"ConsignmentStatus",
            sale_item_id = NULL,
            sold_at = NULL,
            sold_price = NULL,
            updated_at = now()
        WHERE id = ${con.id}::uuid
      `;
    }
  }

  await assertImeiNotInStock(
    tx,
    shopId,
    unit.id,
    unit.imei1,
    unit.imei2,
    (imei) =>
      new BadRequestException(saleCancelImeiAlreadyInStock(saleNo, imei)),
  );

  try {
    const updated = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE inventory_units
      SET status = ${UnitStatus.IN_STOCK}::"UnitStatus", updated_at = now()
      WHERE id = ${unitId}::uuid
        AND shop_id = ${shopId}::uuid
        AND status = ${UnitStatus.SOLD}::"UnitStatus"
      RETURNING id
    `;
    if (!updated?.length) {
      throw new BadRequestException(
        saleCancelUnitNotSold(saleNo, unit.imei1, unit.status),
      );
    }
  } catch (error) {
    if (isImeiUniqueViolation(error)) {
      throw new BadRequestException(
        saleCancelImeiAlreadyInStock(saleNo, unit.imei1),
      );
    }
    throw error;
  }
  await tx.inventoryMovement.create({
    data: {
      shopId,
      productId,
      inventoryUnitId: unitId,
      type: InventoryMovementType.SALE_CANCEL,
      quantityChange: 1,
      reason,
      referenceType: ReferenceType.SALE,
      referenceId: saleId,
    },
  });
}

export async function restoreSaleCancelledStock(
  tx: Tx,
  productId: string,
  quantity: number,
  shopId: string,
  saleId: string,
  reason: string,
): Promise<void> {
  const locked = await tx.$queryRaw<Array<{ quantity_on_hand: number }>>`
    SELECT quantity_on_hand FROM stock_levels
    WHERE product_id = ${productId} AND shop_id = ${shopId}
    FOR UPDATE
  `;
  if (locked?.length) {
    const updated = await tx.$queryRaw<Array<{ product_id: string }>>`
      UPDATE stock_levels
      SET quantity_on_hand = quantity_on_hand + ${quantity}, updated_at = now()
      WHERE product_id = ${productId}::uuid AND shop_id = ${shopId}::uuid
      RETURNING product_id
    `;
    if (!updated?.length) {
      throw new BadRequestException(
        'Stock level row disappeared during restore',
      );
    }
  } else {
    await tx.stockLevel.create({
      data: { productId, shopId, quantityOnHand: quantity, avgUnitCost: 0n },
    });
  }

  await tx.inventoryMovement.create({
    data: {
      shopId,
      productId,
      type: InventoryMovementType.SALE_CANCEL,
      quantityChange: quantity,
      reason,
      referenceType: ReferenceType.SALE,
      referenceId: saleId,
    },
  });
}
