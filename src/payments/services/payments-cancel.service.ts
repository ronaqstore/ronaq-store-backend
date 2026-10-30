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
      select: {
        id: true,
        status: true,
        amount: true,
        saleId: true,
        customerId: true,
        receiptGroupId: true,
      },
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
        Array<{
          id: string;
          status: string;
          amount: bigint | string;
          receipt_group_id: string | null;
          sale_id: string | null;
          customer_id: string | null;
        }>
      >`
        SELECT id, status, amount, receipt_group_id, sale_id, customer_id
        FROM payments
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

      const receiptGroupId = locked[0].receipt_group_id;
      let siblings: Array<{
        id: string;
        amount: bigint;
        saleId: string | null;
        customerId: string | null;
      }>;

      if (receiptGroupId) {
        const groupRows = await tx.$queryRaw<
          Array<{
            id: string;
            status: string;
            amount: bigint | string;
            sale_id: string | null;
            customer_id: string | null;
          }>
        >`
          SELECT id, status, amount, sale_id, customer_id
          FROM payments
          WHERE shop_id = ${shopId}
            AND receipt_group_id = ${receiptGroupId}::uuid
            AND status = ${RecordStatus.ACTIVE}::"RecordStatus"
          FOR UPDATE
        `;
        siblings = groupRows.map((row) => ({
          id: row.id,
          amount: BigInt(row.amount),
          saleId: row.sale_id,
          customerId: row.customer_id,
        }));
      } else {
        siblings = [
          {
            id: locked[0].id,
            amount: BigInt(locked[0].amount),
            saleId: locked[0].sale_id,
            customerId: locked[0].customer_id,
          },
        ];
      }

      if (siblings.length === 0) {
        throw new BadRequestException(
          cancelledRowMutationForbidden('Payment', id),
        );
      }

      let totalAmount = 0n;
      for (const sibling of siblings) totalAmount += sibling.amount;

      let overdraft = false;
      const after =
        (await aggregateCurrentCash(tx, shopId)) - Number(totalAmount);
      if (after < 0) {
        if (!dto.confirmOverdraft) {
          return { kind: 'overdraft' as const, shortfall: -after };
        }
        overdraft = true;
      }

      const now = new Date();
      for (const sibling of siblings) {
        const original = await tx.cashMovement.findFirst({
          where: {
            shopId,
            type: CashMovementType.CUSTOMER_PAYMENT,
            referenceType: ReferenceType.PAYMENT,
            referenceId: sibling.id,
          },
          select: { id: true },
        });
        if (!original) {
          throw new NotFoundException(
            resourceNotFound('Cash movement for payment', sibling.id),
          );
        }

        await tx.payment.update({
          where: { id: sibling.id, shopId },
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
            action: 'PAYMENT_CANCEL',
            entityType: 'Payment',
            entityId: sibling.id,
            reason: dto.cancelReason,
            metadata: {
              amount: Number(sibling.amount),
              saleId: sibling.saleId,
              customerId: sibling.customerId,
              receiptGroupId: receiptGroupId ?? null,
              receiptGroupTotal: Number(totalAmount),
              isOverdraft: overdraft,
            },
          },
        });

        await tx.cashMovement.create({
          data: {
            shopId,
            type: CashMovementType.REVERSAL,
            direction: CashDirection.OUT,
            amount: sibling.amount,
            movementDate: now,
            referenceType: ReferenceType.PAYMENT,
            referenceId: sibling.id,
            reversesMovementId: original.id,
            isOverdraft: overdraft,
            note: dto.cancelReason,
            createdById: userId,
          },
        });
      }

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
      select: {
        id: true,
        status: true,
        amount: true,
        customerId: true,
        receiptGroupId: true,
      },
    });
    if (!payment) {
      throw new NotFoundException(resourceNotFound('Payment', id));
    }
    if (payment.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Payment', id),
      );
    }

    const groupPayments = payment.receiptGroupId
      ? await this.prisma.payment.findMany({
          where: {
            shopId,
            receiptGroupId: payment.receiptGroupId,
            status: RecordStatus.ACTIVE,
          },
          select: { id: true, amount: true, customerId: true },
        })
      : [
          {
            id: payment.id,
            amount: payment.amount,
            customerId: payment.customerId,
          },
        ];

    let totalAmount = 0n;
    for (const row of groupPayments) totalAmount += row.amount;

    const currentCash = await aggregateCurrentCash(this.prisma, shopId);
    const cashAfter = currentCash - Number(totalAmount);

    let customerUdharAfter: number | null = null;
    const customerId = payment.customerId ?? groupPayments[0]?.customerId;
    if (customerId) {
      const [customer, salesAgg, paymentsAgg] = await Promise.all([
        this.prisma.customer.findFirst({
          where: { id: customerId, shopId },
          select: { openingBalance: true },
        }),
        this.prisma.sale.aggregate({
          where: {
            shopId,
            customerId,
            status: RecordStatus.ACTIVE,
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            shopId,
            customerId,
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

        customerUdharAfter = balance + Number(totalAmount);
      }
    }

    return {
      recordType: 'PAYMENT',
      recordId: payment.id,
      recordNo: null,
      currentCash,
      cashReversedAmount: Number(totalAmount),
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
