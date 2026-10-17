import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  InventoryMovementType,
  ReferenceType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateSaleDto } from '../dto/create-sale.dto.js';
import {
  duplicateFieldValue,
  insufficientStock,
  inventoryUnitIdRequiredForSale,
  resourceNotFound,
  unitNotAvailableForSale,
  unwantedSaleItemField,
} from '../../errors/error.builder.js';
import { loadShopProductsById } from '../../helpers/product-catalog.helper.js';

type Tx = Prisma.TransactionClient;

export type ValidatedSaleLine = CreateSaleDto['items'][number] & {
  productName: string;
  trackingType: string;
};

export type LockedSaleLine =
  | {
      line: ValidatedSaleLine;
      unitId: string;
      unitCost: bigint;
      available?: never;
    }
  | {
      line: ValidatedSaleLine;
      unitId?: never;
      unitCost: bigint;
      available: number;
    };

@Injectable()
export class SalesLineWriterService {
  constructor(private readonly prisma: PrismaService) {}

  async validateLines(
    dto: CreateSaleDto,
    shopId: string,
  ): Promise<ValidatedSaleLine[]> {
    const productIds = dto.items.map((line) => line.productId);
    const byId = await loadShopProductsById(this.prisma, productIds, shopId);

    const seenUnits = new Set<string>();
    return dto.items.map((line) => {
      const product = byId.get(line.productId);
      if (!product) {
        throw new NotFoundException(
          resourceNotFound('Product', line.productId),
        );
      }

      if (product.trackingType === 'SERIALIZED') {
        if (!line.inventoryUnitId) {
          throw new BadRequestException(
            inventoryUnitIdRequiredForSale(product.name),
          );
        }
        if (line.quantity !== 1) {
          throw new BadRequestException(
            unwantedSaleItemField(
              product.name,
              'quantity',
              'sells one specific phone, so quantity must be 1',
            ),
          );
        }
        if (seenUnits.has(line.inventoryUnitId)) {
          throw new BadRequestException(
            duplicateFieldValue(
              'Sale line',
              'inventoryUnitId',
              line.inventoryUnitId,
            ),
          );
        }
        seenUnits.add(line.inventoryUnitId);
      } else if (line.inventoryUnitId) {
        throw new BadRequestException(
          unwantedSaleItemField(
            product.name,
            'inventoryUnitId',
            'is tracked by quantity and does not use IMEIs',
          ),
        );
      }

      return {
        ...line,
        productName: product.name,
        trackingType: product.trackingType,
      };
    });
  }

  async lockPhoneLine(
    tx: Tx,
    line: ValidatedSaleLine,
    shopId: string,
  ): Promise<LockedSaleLine> {
    const locked = await tx.$queryRaw<
      Array<{ id: string; status: string; imei1: string; unit_cost: bigint }>
    >`
      SELECT id, status, imei1, unit_cost FROM inventory_units
      WHERE id = ${line.inventoryUnitId} AND shop_id = ${shopId}
        AND product_id = ${line.productId}
      FOR UPDATE
    `;
    if (!locked?.length) {
      throw new NotFoundException(
        resourceNotFound('Inventory unit', line.inventoryUnitId),
      );
    }
    const unit = locked[0];
    if (unit.status !== UnitStatus.IN_STOCK) {
      throw new BadRequestException(
        unitNotAvailableForSale(line.productName, unit.imei1, unit.status),
      );
    }
    return { line, unitId: unit.id, unitCost: BigInt(unit.unit_cost) };
  }

  async lockQuantityLine(
    tx: Tx,
    line: ValidatedSaleLine,
    shopId: string,
  ): Promise<LockedSaleLine> {
    const locked = await tx.$queryRaw<
      Array<{ quantity_on_hand: number; avg_unit_cost: bigint }>
    >`
      SELECT quantity_on_hand, avg_unit_cost FROM stock_levels
      WHERE product_id = ${line.productId} AND shop_id = ${shopId}
      FOR UPDATE
    `;
    const available = locked?.length ? Number(locked[0].quantity_on_hand) : 0;
    if (available < line.quantity) {
      throw new BadRequestException(
        insufficientStock(line.productName, available, line.quantity),
      );
    }
    return {
      line,
      available,
      unitCost: BigInt(locked[0].avg_unit_cost ?? 0),
    };
  }

  async writeLine(
    tx: Tx,
    locked: LockedSaleLine,
    saleId: string,
    shopId: string,
  ): Promise<void> {
    const { line } = locked;

    await tx.saleItem.create({
      data: {
        shopId,
        saleId,
        productId: line.productId,
        inventoryUnitId: locked.unitId ?? null,
        quantity: locked.unitId ? 1 : line.quantity,
        unitPrice: BigInt(line.unitPrice),
        unitCost: locked.unitCost,
        total:
          BigInt(locked.unitId ? 1 : line.quantity) * BigInt(line.unitPrice),
      },
    });

    if (locked.unitId) {
      await tx.inventoryUnit.update({
        where: { id: locked.unitId },
        data: { status: UnitStatus.SOLD },
      });
    } else {
      const onHand = locked.available;
      if (onHand === undefined) {
        throw new BadRequestException('Stock level missing for quantity sale');
      }
      await tx.stockLevel.update({
        where: { productId: line.productId },
        data: { quantityOnHand: onHand - line.quantity },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        shopId,
        productId: line.productId,
        inventoryUnitId: locked.unitId ?? null,
        type: InventoryMovementType.SALE,
        quantityChange: locked.unitId ? -1 : -line.quantity,
        referenceType: ReferenceType.SALE,
        referenceId: saleId,
      },
    });
  }
}
