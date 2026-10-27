import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import {
  InventoryMovementType,
  RecordStatus,
  ReferenceType,
  ReturnCondition,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import type { CreateReturnDto } from '../dto/create-return.dto.js';
import {
  cancelledRowMutationForbidden,
  duplicateFieldValue,
  insufficientStock,
  resourceNotFound,
  returnQuantityExceedsRemaining,
  returnQuantityRequired,
  unitAlreadyReturned,
  unitNotSoldForReturn,
  unwantedReturnItemField,
} from '../../errors/error.builder.js';
import {
  SALE_RETURN_SELECT,
  type SaleForReturn,
  type PreparedReturnLine,
  type ReturnSettlement,
} from '../helpers/return.mapper.js';

type Db = PrismaService | Prisma.TransactionClient;
type Tx = Prisma.TransactionClient;

@Injectable()
export class ReturnsFlowService {
  async prepare(
    db: Db,
    saleId: string,
    shopId: string,
    inputs: CreateReturnDto['items'],
  ): Promise<{
    sale: SaleForReturn;
    lines: PreparedReturnLine[];
    settlement: ReturnSettlement;
  }> {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId },
      select: SALE_RETURN_SELECT,
    });
    if (!sale) {
      throw new NotFoundException(resourceNotFound('Sale', saleId));
    }
    if (sale.status !== RecordStatus.ACTIVE) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Sale', sale.saleNo),
      );
    }

    const lines = await this.validateLines(db, sale, shopId, inputs);
    const settlement = await this.settle(db, sale, shopId, lines);
    return { sale, lines, settlement };
  }

  async validateLines(
    db: Db,
    sale: SaleForReturn,
    shopId: string,
    inputs: CreateReturnDto['items'],
  ): Promise<PreparedReturnLine[]> {
    const byId = new Map(sale.items.map((item) => [item.id, item]));

    const seenSaleItemLines = new Set<string>();
    const requestedByLine = new Map<string, number>();
    const chosen: Array<{
      saleItemId: string;
      quantity: number;
      condition: ReturnCondition;
    }> = [];

    for (const input of inputs) {
      const saleItem = byId.get(input.saleItemId);
      if (!saleItem) {
        throw new NotFoundException(
          resourceNotFound('Sale item', input.saleItemId),
        );
      }
      const productName = saleItem.product.name;

      if (seenSaleItemLines.has(input.saleItemId)) {
        throw new BadRequestException(
          duplicateFieldValue('Return line', 'saleItemId', input.saleItemId),
        );
      }
      seenSaleItemLines.add(input.saleItemId);

      if (saleItem.inventoryUnitId) {
        if (input.quantity !== undefined && input.quantity !== 1) {
          throw new BadRequestException(
            unwantedReturnItemField(
              productName,
              'quantity',
              'sells one specific phone, so quantity must be 1 or left out',
            ),
          );
        }
        chosen.push({
          saleItemId: input.saleItemId,
          quantity: 1,
          condition: input.condition,
        });
      } else {
        if (input.quantity === undefined) {
          throw new BadRequestException(returnQuantityRequired(productName));
        }
        requestedByLine.set(input.saleItemId, input.quantity);
        chosen.push({
          saleItemId: input.saleItemId,
          quantity: input.quantity,
          condition: input.condition,
        });
      }
    }

    const priorRows = await db.returnItem.findMany({
      where: {
        saleItemId: { in: [...new Set(chosen.map((c) => c.saleItemId))] },
        saleReturn: { saleId: sale.id, shopId, status: RecordStatus.ACTIVE },
      },
      select: { saleItemId: true, quantity: true },
    });
    const returnedByLine = new Map<string, number>();
    for (const row of priorRows) {
      returnedByLine.set(
        row.saleItemId,
        (returnedByLine.get(row.saleItemId) ?? 0) + row.quantity,
      );
    }

    for (const [saleItemId, requested] of requestedByLine) {
      const saleItem = byId.get(saleItemId);
      if (!saleItem) {
        throw new NotFoundException(resourceNotFound('Sale item', saleItemId));
      }
      const remaining =
        saleItem.quantity - (returnedByLine.get(saleItemId) ?? 0);
      if (requested > remaining) {
        throw new BadRequestException(
          returnQuantityExceedsRemaining(
            sale.saleNo,
            saleItem.product.name,
            requested,
            remaining,
          ),
        );
      }
    }

    return chosen.map((c) => {
      const saleItem = byId.get(c.saleItemId);
      if (!saleItem) {
        throw new NotFoundException(
          resourceNotFound('Sale item', c.saleItemId),
        );
      }
      if (saleItem.inventoryUnitId) {
        const unit = saleItem.inventoryUnit;
        if (!unit) {
          throw new NotFoundException(
            resourceNotFound('Inventory unit', saleItem.inventoryUnitId),
          );
        }
        if ((returnedByLine.get(c.saleItemId) ?? 0) > 0) {
          throw new BadRequestException(
            unitAlreadyReturned(sale.saleNo, unit.imei1),
          );
        }
        if (unit.status !== UnitStatus.SOLD) {
          throw new BadRequestException(
            unitNotSoldForReturn(sale.saleNo, unit.imei1, unit.status),
          );
        }
        return {
          saleItemId: c.saleItemId,
          productId: saleItem.productId,
          productName: saleItem.product.name,
          inventoryUnitId: saleItem.inventoryUnitId,
          imei: unit.imei1,
          unitPrice: saleItem.unitPrice,
          quantity: c.quantity,
          condition: c.condition,
        };
      }
      return {
        saleItemId: c.saleItemId,
        productId: saleItem.productId,
        productName: saleItem.product.name,
        inventoryUnitId: null,
        imei: null,
        unitPrice: saleItem.unitPrice,
        quantity: c.quantity,
        condition: c.condition,
      };
    });
  }

  async settle(
    db: Db,
    sale: SaleForReturn,
    shopId: string,
    lines: PreparedReturnLine[],
  ): Promise<ReturnSettlement> {
    const paymentsAgg = await db.payment.aggregate({
      where: { shopId, saleId: sale.id, status: RecordStatus.ACTIVE },
      _sum: { amount: true },
    });
    const returnsAgg = await db.saleReturn.aggregate({
      where: { shopId, saleId: sale.id, status: RecordStatus.ACTIVE },
      _sum: { returnAmount: true },
    });
    const refundsAgg = await db.refund.aggregate({
      where: {
        shopId,
        saleReturn: { saleId: sale.id, shopId, status: RecordStatus.ACTIVE },
      },
      _sum: { amount: true },
    });

    const paid = paymentsAgg._sum.amount ?? 0n;
    const priorReturns = returnsAgg._sum.returnAmount ?? 0n;
    const refunded = refundsAgg._sum.amount ?? 0n;

    let gross = 0n;
    for (const line of lines) {
      gross += line.unitPrice * BigInt(line.quantity);
    }

    const discountShare =
      sale.subtotal > 0n ? (sale.discount * gross) / sale.subtotal : 0n;
    const returnAmount = gross - discountShare;

    const outstandingBefore = sale.totalAmount - priorReturns - paid + refunded;
    const byUdhar =
      returnAmount > outstandingBefore ? returnAmount - outstandingBefore : 0n;
    const byCash = paid > refunded ? paid - refunded : 0n;
    const refundable = byUdhar < byCash ? byUdhar : byCash;

    return {
      returnAmount,
      outstandingBefore,
      refundable,
      paidOnSale: paid,
      refundedOnSale: refunded,
      priorReturns,
    };
  }

  async restoreLine(
    tx: Tx,
    sale: SaleForReturn,
    line: PreparedReturnLine,
    shopId: string,
    returnId: string,
    reason: string,
  ): Promise<void> {
    if (line.inventoryUnitId) {
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; imei1: string }>
      >`
        SELECT id, status, imei1 FROM inventory_units
        WHERE id = ${line.inventoryUnitId} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(
          resourceNotFound('Inventory unit', line.inventoryUnitId),
        );
      }
      const unit = locked[0];
      if (unit.status !== UnitStatus.SOLD) {
        throw new BadRequestException(
          unitNotSoldForReturn(sale.saleNo, unit.imei1, unit.status),
        );
      }

      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE inventory_units
        SET status = ${UnitStatus.IN_STOCK}::"UnitStatus", updated_at = now()
        WHERE id = ${unit.id}::uuid
          AND shop_id = ${shopId}::uuid
          AND status = ${UnitStatus.SOLD}::"UnitStatus"
        RETURNING id
      `;
      if (!updated?.length) {
        throw new BadRequestException(
          unitNotSoldForReturn(sale.saleNo, unit.imei1, unit.status),
        );
      }
      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: line.productId,
          inventoryUnitId: unit.id,
          type: InventoryMovementType.CUSTOMER_RETURN,
          quantityChange: 1,
          reason,
          referenceType: ReferenceType.RETURN,
          referenceId: returnId,
        },
      });
      return;
    }

    const locked = await tx.$queryRaw<Array<{ quantity_on_hand: number }>>`
      SELECT quantity_on_hand FROM stock_levels
      WHERE product_id = ${line.productId} AND shop_id = ${shopId}
      FOR UPDATE
    `;
    if (locked?.length) {
      const updated = await tx.$queryRaw<Array<{ product_id: string }>>`
        UPDATE stock_levels
        SET quantity_on_hand = quantity_on_hand + ${line.quantity}, updated_at = now()
        WHERE product_id = ${line.productId}::uuid AND shop_id = ${shopId}::uuid
        RETURNING product_id
      `;
      if (!updated?.length) {
        throw new BadRequestException(
          'Stock level row disappeared during return restore',
        );
      }
    } else {
      await tx.stockLevel.create({
        data: {
          productId: line.productId,
          shopId,
          quantityOnHand: line.quantity,
          avgUnitCost: 0n,
        },
      });
    }
    await tx.inventoryMovement.create({
      data: {
        shopId,
        productId: line.productId,
        type: InventoryMovementType.CUSTOMER_RETURN,
        quantityChange: line.quantity,
        reason,
        referenceType: ReferenceType.RETURN,
        referenceId: returnId,
      },
    });
  }

  async writeOffLine(
    tx: Tx,
    line: PreparedReturnLine,
    shopId: string,
    returnId: string,
    reason: string,
  ): Promise<void> {
    if (line.inventoryUnitId) {
      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE inventory_units
        SET status = ${UnitStatus.DAMAGED}::"UnitStatus", updated_at = now()
        WHERE id = ${line.inventoryUnitId}::uuid
          AND shop_id = ${shopId}::uuid
          AND status = ${UnitStatus.IN_STOCK}::"UnitStatus"
        RETURNING id
      `;
      if (!updated?.length) {
        throw new BadRequestException(
          `Inventory unit ${line.inventoryUnitId} cannot be marked damaged because it is not IN_STOCK`,
        );
      }
      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: line.productId,
          inventoryUnitId: line.inventoryUnitId,
          type: InventoryMovementType.DAMAGED,
          quantityChange: -1,
          reason,
          referenceType: ReferenceType.RETURN,
          referenceId: returnId,
        },
      });
      return;
    }

    const removed = await tx.$executeRaw`
      UPDATE stock_levels
      SET quantity_on_hand = quantity_on_hand - ${line.quantity}, updated_at = now()
      WHERE product_id = ${line.productId} AND shop_id = ${shopId}
        AND quantity_on_hand >= ${line.quantity}
    `;
    if (removed === 0) {
      const current = await tx.stockLevel.findUnique({
        where: { productId: line.productId },
        select: { quantityOnHand: true },
      });
      throw new BadRequestException(
        insufficientStock(
          line.productName,
          current?.quantityOnHand ?? 0,
          line.quantity,
        ),
      );
    }
    await tx.inventoryMovement.create({
      data: {
        shopId,
        productId: line.productId,
        type: InventoryMovementType.DAMAGED,
        quantityChange: -line.quantity,
        reason,
        referenceType: ReferenceType.RETURN,
        referenceId: returnId,
      },
    });
  }
}
