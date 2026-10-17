import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  InventoryMovementType,
  ReferenceType,
  UnitCondition,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreatePurchaseDto } from '../dto/create-purchase.dto.js';
import {
  duplicateImei,
  imeisCountMismatch,
  imeisNotAllowed,
  resourceNotFound,
} from '../../errors/error.builder.js';
import { loadShopProductsById } from '../../helpers/product-catalog.helper.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class PurchasesWriteService {
  constructor(private readonly prisma: PrismaService) {}

  async validateLines(
    dto: CreatePurchaseDto,
    shopId: string,
  ): Promise<CreatePurchaseDto['items']> {
    const productIds = dto.items.map((line) => line.productId);
    const byId = await loadShopProductsById(this.prisma, productIds, shopId);

    const seen = new Set<string>();
    for (const line of dto.items) {
      const product = byId.get(line.productId);
      if (!product) {
        throw new NotFoundException(
          resourceNotFound('Product', line.productId),
        );
      }
      const imeis = line.imeis ?? [];

      if (product.trackingType === 'SERIALIZED') {
        if (imeis.length !== line.quantity) {
          throw new BadRequestException(
            imeisCountMismatch(product.name, line.quantity, imeis.length),
          );
        }
      } else if (imeis.length > 0) {
        throw new BadRequestException(imeisNotAllowed(product.name));
      }

      for (const imei of imeis) {
        if (seen.has(imei)) throw new BadRequestException(duplicateImei(imei));
        seen.add(imei);
      }
    }

    if (seen.size > 0) {
      const inUse = await this.prisma.inventoryUnit.findMany({
        where: { shopId, imei1: { in: [...seen] } },
        select: { imei1: true },
      });
      if (inUse.length > 0) {
        throw new BadRequestException(duplicateImei(inUse[0].imei1));
      }
    }

    return dto.items;
  }

  async insertPurchase(
    tx: Tx,
    dto: CreatePurchaseDto,
    shopId: string,
    userId: string,
    totalAmount: bigint,
  ): Promise<{ id: string }> {
    const rows = await tx.$queryRaw<Array<{ next: number }>>`
      UPDATE shops SET next_purchase_no = next_purchase_no + 1
      WHERE id = ${shopId}
      RETURNING next_purchase_no - 1 AS next
    `;
    if (!rows?.length) {
      throw new NotFoundException(resourceNotFound('Shop', shopId));
    }

    return tx.purchase.create({
      data: {
        shopId,
        supplierId: dto.supplierId,
        purchaseNo: `P-${String(rows[0].next).padStart(4, '0')}`,
        supplierInvoiceRef: dto.supplierInvoiceRef ?? null,
        purchaseDate: new Date(dto.purchaseDate),
        totalAmount,
        isOpeningStock: dto.isOpeningStock ?? false,
        clientRequestId: dto.clientRequestId,
        notes: dto.notes?.trim() ? dto.notes : null,
        createdById: userId,
      },
      select: { id: true },
    });
  }

  async applyStock(
    tx: Tx,
    shopId: string,
    purchaseId: string,
    purchaseItemId: string,
    line: CreatePurchaseDto['items'][number],
  ): Promise<void> {
    const imeis = line.imeis ?? [];

    if (imeis.length > 0) {
      for (const imei of imeis) {
        const unit = await tx.inventoryUnit.create({
          data: {
            shopId,
            productId: line.productId,
            purchaseItemId,
            imei1: imei,
            condition: line.condition ?? UnitCondition.NEW,
            unitCost: BigInt(line.unitCost),
          },
          select: { id: true },
        });
        await tx.inventoryMovement.create({
          data: {
            shopId,
            productId: line.productId,
            inventoryUnitId: unit.id,
            type: InventoryMovementType.PURCHASE,
            quantityChange: 1,
            referenceType: ReferenceType.PURCHASE,
            referenceId: purchaseId,
          },
        });
      }
      return;
    }

    const current = await tx.stockLevel.findUnique({
      where: { productId: line.productId },
    });
    const oldQty = current?.quantityOnHand ?? 0;
    const newQty = oldQty + line.quantity;
    const newAvg = Math.round(
      (oldQty * Number(current?.avgUnitCost ?? 0) +
        line.quantity * line.unitCost) /
        newQty,
    );

    if (current) {
      await tx.stockLevel.update({
        where: { productId: line.productId },
        data: { quantityOnHand: newQty, avgUnitCost: BigInt(newAvg) },
      });
    } else {
      await tx.stockLevel.create({
        data: {
          productId: line.productId,
          shopId,
          quantityOnHand: newQty,
          avgUnitCost: BigInt(newAvg),
        },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        shopId,
        productId: line.productId,
        type: InventoryMovementType.PURCHASE,
        quantityChange: line.quantity,
        referenceType: ReferenceType.PURCHASE,
        referenceId: purchaseId,
      },
    });
  }
}
