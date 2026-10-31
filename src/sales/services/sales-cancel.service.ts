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
  PaymentMethod,
  RecordStatus,
  ReferenceType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CancelSaleDto } from '../dto/cancel-sale.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import {
  CancelImpactResponseDto,
  CancelImpactStockItemDto,
} from '../../common-dto/response/cancel-impact.dto.js';
import { aggregateCurrentCash } from '../../helpers/cash-balance.helper.js';
import { lockShopForUpdate } from '../../helpers/shop-lock.helper.js';
import {
  cancelledRowMutationForbidden,
  resourceNotFound,
  saleCancelImeiAlreadyInStock,
  saleCancelUnitNotSold,
  saleHasReturns,
} from '../../errors/error.builder.js';
import {
  assertImeiNotInStock,
  findConflictingInStockUnit,
} from '../../helpers/inventory-imei.helper.js';
import { isImeiUniqueViolation } from '../../helpers/prisma-error-helper.js';

type Tx = Prisma.TransactionClient;

const CANCELLED = 'Sale cancelled successfully';

export type CancelSaleResult =
  StatusBaseResponseDTO | PurchaseOverdraftResponseDto;

@Injectable()
export class SalesCancelService {
  constructor(private readonly prisma: PrismaService) {}

  async cancelSale(
    id: string,
    dto: CancelSaleDto,
    shopId: string,
    userId: string,
  ): Promise<CancelSaleResult> {
    const sale = await this.prisma.sale.findFirst({
      where: { id, shopId },
      select: { id: true, status: true, saleNo: true },
    });
    if (!sale) {
      throw new NotFoundException(resourceNotFound('Sale', id));
    }
    if (sale.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Sale', sale.saleNo),
      );
    }

    const returnCount = await this.prisma.saleReturn.count({
      where: { shopId, saleId: id, status: RecordStatus.ACTIVE },
    });
    if (returnCount > 0) {
      throw new BadRequestException(saleHasReturns(sale.saleNo));
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockShopForUpdate(tx, shopId);

      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM sales
        WHERE id = ${id} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(resourceNotFound('Sale', id));
      }
      if (locked[0].status !== RecordStatus.ACTIVE) {
        throw new BadRequestException(
          cancelledRowMutationForbidden('Sale', sale.saleNo),
        );
      }

      const inTxReturns = await tx.saleReturn.count({
        where: { shopId, saleId: id, status: RecordStatus.ACTIVE },
      });
      if (inTxReturns > 0) {
        throw new BadRequestException(saleHasReturns(sale.saleNo));
      }

      const items = await tx.saleItem.findMany({
        where: { saleId: id },
        select: {
          productId: true,
          inventoryUnitId: true,
          quantity: true,
          product: { select: { name: true } },
        },
      });
      const payments = await tx.payment.findMany({
        where: { shopId, saleId: id, status: RecordStatus.ACTIVE },
        select: { id: true, amount: true, method: true },
      });

      let refund = 0n;
      for (const payment of payments) {
        const m = payment.method ?? PaymentMethod.CASH;
        if (m === PaymentMethod.CASH) {
          refund += payment.amount;
        }
      }

      let overdraft = false;
      if (refund > 0n) {
        const after = (await aggregateCurrentCash(tx, shopId)) - Number(refund);
        if (after < 0) {
          if (!dto.confirmOverdraft) {
            return { kind: 'overdraft' as const, shortfall: -after };
          }
          overdraft = true;
        }
      }

      const now = new Date();

      for (const item of items) {
        if (item.inventoryUnitId) {
          await this.restoreUnit(
            tx,
            item.inventoryUnitId,
            item.productId,
            shopId,
            sale.saleNo,
            id,
            dto.cancelReason,
          );
        } else {
          await this.restoreStock(
            tx,
            item.productId,
            item.quantity,
            shopId,
            id,
            dto.cancelReason,
          );
        }
      }

      for (const payment of payments) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: RecordStatus.CANCELLED,
            cancelledAt: now,
            cancelReason: dto.cancelReason,
            cancelledById: userId,
          },
        });

        const m = payment.method ?? PaymentMethod.CASH;
        if (m === PaymentMethod.CASH) {
          const original = await tx.cashMovement.findFirst({
            where: {
              shopId,
              type: CashMovementType.CUSTOMER_PAYMENT,
              referenceType: ReferenceType.PAYMENT,
              referenceId: payment.id,
            },
            select: { id: true },
          });
          if (!original) {
            throw new NotFoundException(
              resourceNotFound('Cash movement for payment', payment.id),
            );
          }

          await tx.cashMovement.create({
            data: {
              shopId,
              type: CashMovementType.REVERSAL,
              direction: CashDirection.OUT,
              amount: payment.amount,
              movementDate: now,
              referenceType: ReferenceType.PAYMENT,
              referenceId: payment.id,
              reversesMovementId: original.id,
              isOverdraft: overdraft,
              note: dto.cancelReason,
              createdById: userId,
            },
          });
        }
      }

      await tx.sale.update({
        where: { id, shopId },
        data: {
          status: RecordStatus.CANCELLED,
          cancelledAt: now,
          cancelReason: dto.cancelReason,
          cancelledById: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          shopId,
          userId,
          action: 'SALE_CANCEL',
          entityType: 'Sale',
          entityId: id,
          reason: dto.cancelReason,
          metadata: {
            saleNo: sale.saleNo,
            refundAmount: Number(refund),
            itemCount: items.length,
            isOverdraft: overdraft,
          },
        },
      });

      return { kind: 'cancelled' as const };
    });

    if (outcome.kind === 'overdraft') {
      return new PurchaseOverdraftResponseDto(
        outcome.shortfall,
        'sale cancellation',
      );
    }
    return new StatusBaseResponseDTO(true, CANCELLED);
  }

  async getCancelImpact(
    id: string,
    shopId: string,
  ): Promise<CancelImpactResponseDto> {
    const sale = await this.prisma.sale.findFirst({
      where: { id, shopId },
      select: {
        id: true,
        saleNo: true,
        status: true,
        totalAmount: true,
        customerId: true,
        items: {
          select: {
            inventoryUnitId: true,
            quantity: true,
            product: { select: { name: true } },
            inventoryUnit: {
              select: { imei1: true, imei2: true, status: true },
            },
          },
        },
      },
    });
    if (!sale) {
      throw new NotFoundException(resourceNotFound('Sale', id));
    }
    if (sale.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Sale', sale.saleNo),
      );
    }

    const payments = await this.prisma.payment.findMany({
      where: { shopId, saleId: id, status: RecordStatus.ACTIVE },
      select: { amount: true, method: true },
    });
    let refund = 0n;
    for (const payment of payments) {
      const m = payment.method ?? PaymentMethod.CASH;
      if (m === PaymentMethod.CASH) {
        refund += payment.amount;
      }
    }

    const currentCash = await aggregateCurrentCash(this.prisma, shopId);
    const cashAfter = currentCash - Number(refund);

    const stockItems: CancelImpactStockItemDto[] = [];
    let blocked = false;
    let blockedReason: string | null = null;

    const impactReturnCount = await this.prisma.saleReturn.count({
      where: { shopId, saleId: id, status: RecordStatus.ACTIVE },
    });
    if (impactReturnCount > 0) {
      blocked = true;
      blockedReason = saleHasReturns(sale.saleNo).message.join(' ');
    }
    for (const item of sale.items) {
      if (item.inventoryUnitId) {
        const unit = item.inventoryUnit;
        if (!unit) {
          throw new NotFoundException(
            resourceNotFound('Inventory unit', item.inventoryUnitId),
          );
        }
        stockItems.push({
          productName: item.product.name,
          imei: unit.imei1,
          quantityChange: 1,
        });
        if (!blocked) {
          if (unit.status !== UnitStatus.SOLD) {
            blocked = true;
            blockedReason = saleCancelUnitNotSold(
              sale.saleNo,
              unit.imei1,
              unit.status,
            ).message.join(' ');
          } else {
            const conflict = await findConflictingInStockUnit(
              this.prisma,
              shopId,
              item.inventoryUnitId,
              unit.imei1,
              unit.imei2,
            );
            if (conflict) {
              blocked = true;
              blockedReason = saleCancelImeiAlreadyInStock(
                sale.saleNo,
                unit.imei1,
              ).message.join(' ');
            }
          }
        }
      } else {
        stockItems.push({
          productName: item.product.name,
          imei: null,
          quantityChange: item.quantity,
        });
      }
    }

    let customerUdharAfter: number | null = null;
    if (sale.customerId) {
      const [customer, salesAgg, paymentsAgg, returnsAgg, refundsAgg] =
        await Promise.all([
          this.prisma.customer.findFirst({
            where: { id: sale.customerId, shopId },
            select: { openingBalance: true },
          }),
          this.prisma.sale.aggregate({
            where: {
              shopId,
              customerId: sale.customerId,
              status: RecordStatus.ACTIVE,
            },
            _sum: { totalAmount: true },
          }),
          this.prisma.payment.aggregate({
            where: {
              shopId,
              customerId: sale.customerId,
              status: RecordStatus.ACTIVE,
            },
            _sum: { amount: true },
          }),
          this.prisma.saleReturn.aggregate({
            where: {
              shopId,
              customerId: sale.customerId,
              status: RecordStatus.ACTIVE,
            },
            _sum: { returnAmount: true },
          }),
          this.prisma.refund.aggregate({
            where: {
              shopId,
              saleReturn: {
                customerId: sale.customerId,
                status: RecordStatus.ACTIVE,
              },
            },
            _sum: { amount: true },
          }),
        ]);
      if (customer) {
        const balance =
          Number(customer.openingBalance) +
          Number(salesAgg._sum.totalAmount ?? 0n) -
          Number(paymentsAgg._sum.amount ?? 0n) -
          Number(returnsAgg._sum.returnAmount ?? 0n) +
          Number(refundsAgg._sum.amount ?? 0n);

        customerUdharAfter =
          balance - Number(sale.totalAmount) + Number(refund);
      }
    }

    return {
      recordType: 'SALE',
      recordId: sale.id,
      recordNo: sale.saleNo,
      currentCash,
      cashReversedAmount: Number(refund),
      cashReversedDirection: 'OUT',
      cashAfter,
      willCauseOverdraft: cashAfter < 0,
      customerUdharAfter,
      supplierPayableAfter: null,
      stockItems,
      blocked,
      blockedReason,
    };
  }

  private async restoreUnit(
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
      }>
    >`
      SELECT id, status, imei1, imei2 FROM inventory_units
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

  private async restoreStock(
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
}
