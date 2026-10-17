import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CashDirection,
  CashMovementType,
  RecordStatus,
  ReferenceType,
} from '../../generated/prisma/enums.js';
import { CancelPaymentDto } from '../dto/cancel-payment.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { CancelImpactResponseDto } from '../../common-dto/response/cancel-impact.dto.js';
import { aggregateCurrentCash } from '../../helpers/cash-balance.helper.js';
import { lockShopForUpdate } from '../../helpers/shop-lock.helper.js';
import {
  cancelledRowMutationForbidden,
  resourceNotFound,
} from '../../errors/error.builder.js';
export type CancelPaymentResult =
  StatusBaseResponseDTO | PurchaseOverdraftResponseDto;

const CANCELLED = 'Payment cancelled successfully';

@Injectable()
export class PaymentsCancelService {
  constructor(private readonly prisma: PrismaService) {}

  async cancelPayment(
    id: string,
    dto: CancelPaymentDto,
    shopId: string,
    userId: string,
  ): Promise<CancelPaymentResult> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, shopId },
      select: { id: true, status: true, amount: true },
    });
    if (!payment) {
      throw new NotFoundException(resourceNotFound('Payment', id));
    }
    if (payment.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Payment', id),
      );
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockShopForUpdate(tx, shopId);

      const locked = await tx.$queryRaw<
        Array<{ status: string; amount: bigint | string }>
      >`
        SELECT status, amount FROM payments
        WHERE id = ${id} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(resourceNotFound('Payment', id));
      }
      if (locked[0].status !== RecordStatus.ACTIVE) {
        throw new BadRequestException(
          cancelledRowMutationForbidden('Payment', id),
        );
      }
      const amount = BigInt(locked[0].amount);

      const original = await tx.cashMovement.findFirst({
        where: {
          shopId,
          type: CashMovementType.CUSTOMER_PAYMENT,
          referenceType: ReferenceType.PAYMENT,
          referenceId: id,
        },
        select: { id: true },
      });
      if (!original) {
        throw new NotFoundException(
          resourceNotFound('Cash movement for payment', id),
        );
      }

      let overdraft = false;
      const after = (await aggregateCurrentCash(tx, shopId)) - Number(amount);
      if (after < 0) {
        if (!dto.confirmOverdraft) {
          return { kind: 'overdraft' as const, shortfall: -after };
        }
        overdraft = true;
      }

      const now = new Date();
      await tx.payment.update({
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
          direction: CashDirection.OUT,
          amount,
          movementDate: now,
          referenceType: ReferenceType.PAYMENT,
          referenceId: id,
          reversesMovementId: original.id,
          isOverdraft: overdraft,
          note: dto.cancelReason,
          createdById: userId,
        },
      });

      return { kind: 'cancelled' as const };
    });

    if (outcome.kind === 'overdraft') {
      return new PurchaseOverdraftResponseDto(
        outcome.shortfall,
        'payment cancellation',
      );
    }
    return new StatusBaseResponseDTO(true, CANCELLED);
  }

  async getCancelImpact(
    id: string,
    shopId: string,
  ): Promise<CancelImpactResponseDto> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, shopId },
      select: { id: true, status: true, amount: true, customerId: true },
    });
    if (!payment) {
      throw new NotFoundException(resourceNotFound('Payment', id));
    }
    if (payment.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Payment', id),
      );
    }

    const currentCash = await aggregateCurrentCash(this.prisma, shopId);
    const cashAfter = currentCash - Number(payment.amount);

    let customerUdharAfter: number | null = null;
    if (payment.customerId) {
      const [customer, salesAgg, paymentsAgg] = await Promise.all([
        this.prisma.customer.findFirst({
          where: { id: payment.customerId, shopId },
          select: { openingBalance: true },
        }),
        this.prisma.sale.aggregate({
          where: {
            shopId,
            customerId: payment.customerId,
            status: RecordStatus.ACTIVE,
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            shopId,
            customerId: payment.customerId,
            status: RecordStatus.ACTIVE,
          },
          _sum: { amount: true },
        }),
      ]);
      if (customer) {
        const balance =
          Number(customer.openingBalance) +
          Number(salesAgg._sum.totalAmount ?? 0n) -
          Number(paymentsAgg._sum.amount ?? 0n);

        customerUdharAfter = balance + Number(payment.amount);
      }
    }

    return {
      recordType: 'PAYMENT',
      recordId: payment.id,
      recordNo: null,
      currentCash,
      cashReversedAmount: Number(payment.amount),
      cashReversedDirection: 'OUT',
      cashAfter,
      willCauseOverdraft: cashAfter < 0,
      customerUdharAfter,
      supplierPayableAfter: null,
      stockItems: [],
      blocked: false,
      blockedReason: null,
    };
  }
}
