import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  CashDirection,
  CashMovementType,
  ReferenceType,
  RecordStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CancelSupplierPaymentDto } from '../dto/cancel-supplier-payment.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { CancelImpactResponseDto } from '../../common-dto/response/cancel-impact.dto.js';
import { aggregateCurrentCash } from '../../helpers/cash-balance.helper.js';
import {
  cancelledRowMutationForbidden,
  resourceNotFound,
} from '../../errors/error.builder.js';

type Tx = Prisma.TransactionClient;

const CANCELLED = 'Supplier payment cancelled successfully';

@Injectable()
export class SupplierPaymentsCancelService {
  constructor(private readonly prisma: PrismaService) {}

  async cancelSupplierPayment(
    id: string,
    dto: CancelSupplierPaymentDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id, shopId },
      select: { id: true, status: true, purchaseId: true },
    });
    if (!payment) {
      throw new NotFoundException(resourceNotFound('Supplier payment', id));
    }
    if (payment.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Supplier payment', id),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const shop = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE
      `;
      if (!shop?.length) {
        throw new NotFoundException(resourceNotFound('Shop', shopId));
      }

      const locked = await tx.$queryRaw<
        Array<{ status: string; amount: bigint | string }>
      >`
        SELECT status, amount FROM supplier_payments
        WHERE id = ${id} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(resourceNotFound('Supplier payment', id));
      }
      if (locked[0].status !== RecordStatus.ACTIVE) {
        throw new BadRequestException(
          cancelledRowMutationForbidden('Supplier payment', id),
        );
      }
      const amount = BigInt(locked[0].amount);

      const original = await this.originalCashMovement(
        tx,
        shopId,
        payment.id,
        payment.purchaseId,
      );
      if (!original) {
        throw new NotFoundException(
          resourceNotFound('Cash movement for supplier payment', id),
        );
      }

      const now = new Date();
      await tx.supplierPayment.update({
        where: { id, shopId },
        data: {
          status: RecordStatus.CANCELLED,
          cancelledAt: now,
          cancelReason: dto.cancelReason,
          cancelledById: userId,
        },
      });

      await tx.cashMovement.create({
        data: {
          shopId,
          type: CashMovementType.REVERSAL,
          direction: CashDirection.IN,
          amount,
          movementDate: now,
          referenceType: ReferenceType.SUPPLIER_PAYMENT,
          referenceId: id,
          reversesMovementId: original.id,
          note: dto.cancelReason,
          createdById: userId,
        },
      });
    });

    return new StatusBaseResponseDTO(true, CANCELLED);
  }

  async getCancelImpact(
    id: string,
    shopId: string,
  ): Promise<CancelImpactResponseDto> {
    const payment = await this.prisma.supplierPayment.findFirst({
      where: { id, shopId },
      select: { id: true, status: true, amount: true, supplierId: true },
    });
    if (!payment) {
      throw new NotFoundException(resourceNotFound('Supplier payment', id));
    }
    if (payment.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Supplier payment', id),
      );
    }

    const currentCash = await aggregateCurrentCash(this.prisma, shopId);
    const cashAfter = currentCash + Number(payment.amount);

    let supplierPayableAfter: number | null = null;
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: payment.supplierId, shopId },
      select: { openingBalance: true },
    });
    if (supplier) {
      const [purchasesAgg, paymentsAgg] = await Promise.all([
        this.prisma.purchase.aggregate({
          where: {
            shopId,
            supplierId: payment.supplierId,
            status: RecordStatus.ACTIVE,
            isOpeningStock: false,
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.supplierPayment.aggregate({
          where: {
            shopId,
            supplierId: payment.supplierId,
            status: RecordStatus.ACTIVE,
          },
          _sum: { amount: true },
        }),
      ]);
      const payable =
        Number(supplier.openingBalance) +
        Number(purchasesAgg._sum.totalAmount ?? 0n) -
        Number(paymentsAgg._sum.amount ?? 0n);

      supplierPayableAfter = payable + Number(payment.amount);
    }

    return {
      recordType: 'SUPPLIER_PAYMENT',
      recordId: payment.id,
      recordNo: null,
      currentCash,
      cashReversedAmount: Number(payment.amount),
      cashReversedDirection: 'IN',
      cashAfter,
      willCauseOverdraft: cashAfter < 0,
      customerUdharAfter: null,
      supplierPayableAfter,
      stockItems: [],
      blocked: false,
      blockedReason: null,
    };
  }

  private async originalCashMovement(
    tx: Tx,
    shopId: string,
    paymentId: string,
    purchaseId: string | null,
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
    if (!purchaseId) return null;

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
