import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  CashDirection,
  CashMovementType,
  InventoryMovementType,
  RecordStatus,
  ReferenceType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CancelPurchaseDto } from '../dto/cancel-purchase.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import {
  CancelImpactResponseDto,
  CancelImpactStockItemDto,
} from '../../common-dto/response/cancel-impact.dto.js';
import { aggregateCurrentCash } from '../../helpers/cash-balance.helper.js';
import {
  cancelledRowMutationForbidden,
  insufficientStock,
  purchaseCancelUnitNotInStock,
  resourceNotFound,
} from '../../errors/error.builder.js';

type Tx = Prisma.TransactionClient;

const CANCELLED = 'Purchase cancelled successfully';

@Injectable()
export class PurchasesCancelService {
  constructor(private readonly prisma: PrismaService) {}

  async cancelPurchase(
    id: string,
    dto: CancelPurchaseDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, shopId },
      select: { id: true, status: true, purchaseNo: true },
    });
    if (!purchase) {
      throw new NotFoundException(resourceNotFound('Purchase', id));
    }
    if (purchase.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Purchase', purchase.purchaseNo),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const shop = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE
      `;
      if (!shop?.length) {
        throw new NotFoundException(resourceNotFound('Shop', shopId));
      }

      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM purchases
        WHERE id = ${id} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(resourceNotFound('Purchase', id));
      }
      if (locked[0].status !== RecordStatus.ACTIVE) {
        throw new BadRequestException(
          cancelledRowMutationForbidden('Purchase', purchase.purchaseNo),
        );
      }

      const items = await tx.purchaseItem.findMany({
        where: { purchaseId: id },
        select: {
          productId: true,
          quantity: true,
          product: { select: { name: true, trackingType: true } },
          inventoryUnits: { select: { id: true, imei1: true, imei2: true } },
        },
      });

      const now = new Date();

      for (const item of items) {
        if (item.product.trackingType === 'SERIALIZED') {
          for (const unit of item.inventoryUnits) {
            const lockedUnit = await tx.$queryRaw<
              Array<{
                id: string;
                status: string;
                imei1: string;
                imei2: string;
              }>
            >`
              SELECT id, status, imei1, imei2 FROM inventory_units
              WHERE id = ${unit.id} AND shop_id = ${shopId}
              FOR UPDATE
            `;
            if (!lockedUnit?.length) {
              throw new NotFoundException(
                resourceNotFound('Inventory unit', unit.id),
              );
            }
            if (lockedUnit[0].status !== UnitStatus.IN_STOCK) {
              throw new BadRequestException(
                purchaseCancelUnitNotInStock(
                  purchase.purchaseNo,
                  lockedUnit[0].imei1,
                  lockedUnit[0].status,
                ),
              );
            }

            await tx.inventoryUnit.update({
              where: { id: unit.id },
              data: {
                status: UnitStatus.VOIDED,
                imei1: `${lockedUnit[0].imei1}_VOID_${unit.id}`,
                ...(lockedUnit[0].imei2
                  ? { imei2: `${lockedUnit[0].imei2}_VOID_${unit.id}` }
                  : {}),
              },
            });
            await tx.inventoryMovement.create({
              data: {
                shopId,
                productId: item.productId,
                inventoryUnitId: unit.id,
                type: InventoryMovementType.PURCHASE_CANCEL,
                quantityChange: -1,
                reason: dto.cancelReason,
                referenceType: ReferenceType.PURCHASE,
                referenceId: id,
              },
            });
          }
          continue;
        }

        const lockedStock = await tx.$queryRaw<
          Array<{ quantity_on_hand: number }>
        >`
          SELECT quantity_on_hand FROM stock_levels
          WHERE product_id = ${item.productId} AND shop_id = ${shopId}
          FOR UPDATE
        `;
        const available = lockedStock?.length
          ? Number(lockedStock[0].quantity_on_hand)
          : 0;
        if (available < item.quantity) {
          throw new BadRequestException(
            insufficientStock(item.product.name, available, item.quantity),
          );
        }

        await tx.stockLevel.update({
          where: { productId: item.productId },
          data: { quantityOnHand: available - item.quantity },
        });
        await tx.inventoryMovement.create({
          data: {
            shopId,
            productId: item.productId,
            type: InventoryMovementType.PURCHASE_CANCEL,
            quantityChange: -item.quantity,
            reason: dto.cancelReason,
            referenceType: ReferenceType.PURCHASE,
            referenceId: id,
          },
        });
      }

      const payments = await tx.supplierPayment.findMany({
        where: { shopId, purchaseId: id, status: RecordStatus.ACTIVE },
        select: { id: true, amount: true },
      });
      for (const payment of payments) {
        await tx.supplierPayment.update({
          where: { id: payment.id },
          data: {
            status: RecordStatus.CANCELLED,
            cancelledAt: now,
            cancelReason: dto.cancelReason,
            cancelledById: userId,
          },
        });

        const original = await this.originalSupplierCash(
          tx,
          shopId,
          payment.id,
          id,
        );
        if (!original) {
          throw new NotFoundException(
            resourceNotFound('Cash movement for supplier payment', payment.id),
          );
        }

        await tx.cashMovement.create({
          data: {
            shopId,
            type: CashMovementType.REVERSAL,
            direction: CashDirection.IN,
            amount: payment.amount,
            movementDate: now,
            referenceType: ReferenceType.SUPPLIER_PAYMENT,
            referenceId: payment.id,
            reversesMovementId: original.id,
            note: dto.cancelReason,
            createdById: userId,
          },
        });
      }

      await tx.purchase.update({
        where: { id, shopId },
        data: {
          status: RecordStatus.CANCELLED,
          cancelledAt: now,
          cancelReason: dto.cancelReason,
          cancelledById: userId,
        },
      });
    });

    return new StatusBaseResponseDTO(true, CANCELLED);
  }

  async getCancelImpact(
    id: string,
    shopId: string,
  ): Promise<CancelImpactResponseDto> {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, shopId },
      select: {
        id: true,
        purchaseNo: true,
        status: true,
        totalAmount: true,
        supplierId: true,
        isOpeningStock: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            product: { select: { name: true, trackingType: true } },
            inventoryUnits: { select: { imei1: true, status: true } },
          },
        },
      },
    });
    if (!purchase) {
      throw new NotFoundException(resourceNotFound('Purchase', id));
    }
    if (purchase.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Purchase', purchase.purchaseNo),
      );
    }

    const stockItems: CancelImpactStockItemDto[] = [];
    let blocked = false;
    let blockedReason: string | null = null;
    for (const item of purchase.items) {
      if (item.product.trackingType === 'SERIALIZED') {
        for (const unit of item.inventoryUnits) {
          stockItems.push({
            productName: item.product.name,
            imei: unit.imei1,
            quantityChange: -1,
          });
          if (!blocked && unit.status !== UnitStatus.IN_STOCK) {
            blocked = true;
            blockedReason = purchaseCancelUnitNotInStock(
              purchase.purchaseNo,
              unit.imei1,
              unit.status,
            ).message.join(' ');
          }
        }
        continue;
      }

      stockItems.push({
        productName: item.product.name,
        imei: null,
        quantityChange: -item.quantity,
      });
      const stock = await this.prisma.stockLevel.findFirst({
        where: { productId: item.productId, shopId },
        select: { quantityOnHand: true },
      });
      const available = stock ? Number(stock.quantityOnHand) : 0;
      if (!blocked && available < item.quantity) {
        blocked = true;
        blockedReason = insufficientStock(
          item.product.name,
          available,
          item.quantity,
        ).message.join(' ');
      }
    }

    const billPayments = await this.prisma.supplierPayment.findMany({
      where: { shopId, purchaseId: id, status: RecordStatus.ACTIVE },
      select: { amount: true },
    });
    let reversed = 0n;
    for (const payment of billPayments) reversed += payment.amount;

    const currentCash = await aggregateCurrentCash(this.prisma, shopId);
    const cashAfter = currentCash + Number(reversed);

    let supplierPayableAfter: number | null = null;
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: purchase.supplierId, shopId },
      select: { openingBalance: true },
    });
    if (supplier) {
      const [purchasesAgg, paymentsAgg] = await Promise.all([
        this.prisma.purchase.aggregate({
          where: {
            shopId,
            supplierId: purchase.supplierId,
            status: RecordStatus.ACTIVE,
            isOpeningStock: false,
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.supplierPayment.aggregate({
          where: {
            shopId,
            supplierId: purchase.supplierId,
            status: RecordStatus.ACTIVE,
          },
          _sum: { amount: true },
        }),
      ]);
      const payable =
        Number(supplier.openingBalance) +
        Number(purchasesAgg._sum.totalAmount ?? 0n) -
        Number(paymentsAgg._sum.amount ?? 0n);

      supplierPayableAfter =
        payable -
        (purchase.isOpeningStock ? 0 : Number(purchase.totalAmount)) +
        Number(reversed);
    }

    return {
      recordType: 'PURCHASE',
      recordId: purchase.id,
      recordNo: purchase.purchaseNo,
      currentCash,
      cashReversedAmount: Number(reversed),
      cashReversedDirection: 'IN',
      cashAfter,
      willCauseOverdraft: cashAfter < 0,
      customerUdharAfter: null,
      supplierPayableAfter,
      stockItems,
      blocked,
      blockedReason,
    };
  }

  private async originalSupplierCash(
    tx: Tx,
    shopId: string,
    paymentId: string,
    purchaseId: string,
  ): Promise<{ id: string } | null> {
    const own = await tx.cashMovement.findFirst({
      where: {
        shopId,
        type: CashMovementType.SUPPLIER_PAYMENT,
        referenceType: ReferenceType.SUPPLIER_PAYMENT,
        referenceId: paymentId,
      },
      select: { id: true },
    });
    if (own) return own;

    return tx.cashMovement.findFirst({
      where: {
        shopId,
        type: CashMovementType.SUPPLIER_PAYMENT,
        referenceType: ReferenceType.PURCHASE,
        referenceId: purchaseId,
      },
      select: { id: true },
    });
  }
}
