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
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreatePurchaseDto } from '../dto/create-purchase.dto.js';
import {
  batteryHealthNotAllowed,
  batteryHealthOutOfRange,
  duplicateImei,
  imeiPairMustDiffer,
  imeisCountMismatch,
  imeisNotAllowed,
  resourceNotFound,
} from '../../errors/error.builder.js';
import { isAppleBrandName } from '../../helpers/device-family.helper.js';
import { loadShopProductsById } from '../../helpers/product-catalog.helper.js';

type Tx = Prisma.TransactionClient;

const STOCK_WRITE_CHUNK = 500;

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
      const phoneUnits = line.phoneUnits ?? [];

      if (product.trackingType === 'SERIALIZED') {
        if (phoneUnits.length !== line.quantity) {
          throw new BadRequestException(
            imeisCountMismatch(product.name, line.quantity, phoneUnits.length),
          );
        }
      } else if (phoneUnits.length > 0) {
        throw new BadRequestException(imeisNotAllowed(product.name));
      }

      for (const unit of phoneUnits) {
        if (unit.imei1 === unit.imei2) {
          throw new BadRequestException(imeiPairMustDiffer(unit.imei1));
        }
        for (const imei of [unit.imei1, unit.imei2]) {
          if (seen.has(imei))
            throw new BadRequestException(duplicateImei(imei));
          seen.add(imei);
        }
        if (unit.batteryHealth != null) {
          if (!isAppleBrandName(product.brandName)) {
            throw new BadRequestException(
              batteryHealthNotAllowed(product.name),
            );
          }
          if (unit.batteryHealth < 1 || unit.batteryHealth > 100) {
            throw new BadRequestException(batteryHealthOutOfRange());
          }
        }
      }
    }

    if (seen.size > 0) {
      const values = [...seen];
      const inUse = await this.prisma.inventoryUnit.findFirst({
        where: {
          shopId,
          status: { not: UnitStatus.VOIDED },
          OR: [{ imei1: { in: values } }, { imei2: { in: values } }],
        },
        select: { imei1: true, imei2: true },
      });
      if (inUse) {
        const hit =
          values.find((v) => v === inUse.imei1 || v === inUse.imei2) ??
          inUse.imei1;
        throw new BadRequestException(duplicateImei(hit));
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
    const phoneUnits = line.phoneUnits ?? [];

    if (phoneUnits.length > 0) {
      const unitIds: string[] = [];
      for (let i = 0; i < phoneUnits.length; i += STOCK_WRITE_CHUNK) {
        const chunk = phoneUnits.slice(i, i + STOCK_WRITE_CHUNK);
        const units = await tx.inventoryUnit.createManyAndReturn({
          data: chunk.map((unit) => ({
            shopId,
            productId: line.productId,
            purchaseItemId,
            imei1: unit.imei1,
            imei2: unit.imei2,
            condition: unit.condition ?? line.condition ?? UnitCondition.NEW,
            unitCost: BigInt(line.unitCost),
            batteryHealth: unit.batteryHealth ?? null,
            askingPrice:
              unit.askingPrice != null ? BigInt(unit.askingPrice) : null,
            defectNotes: unit.defectNotes?.trim()
              ? unit.defectNotes.trim()
              : null,
          })),
          select: { id: true },
        });
        for (const created of units) unitIds.push(created.id);
      }

      for (let i = 0; i < unitIds.length; i += STOCK_WRITE_CHUNK) {
        const chunk = unitIds.slice(i, i + STOCK_WRITE_CHUNK);
        await tx.inventoryMovement.createMany({
          data: chunk.map((inventoryUnitId) => ({
            shopId,
            productId: line.productId,
            inventoryUnitId,
            type: InventoryMovementType.PURCHASE,
            quantityChange: 1,
            referenceType: ReferenceType.PURCHASE,
            referenceId: purchaseId,
          })),
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
