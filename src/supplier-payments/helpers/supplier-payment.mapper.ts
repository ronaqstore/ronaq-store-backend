import type { Prisma } from '../../generated/prisma/client.js';
import { RecordStatus } from '../../generated/prisma/enums.js';
import type { CreateSupplierPaymentDto } from '../dto/create-supplier-payment.dto.js';
import { ResponseSupplierPaymentDto } from '../dto/response-supplier-payment.dto.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  cancelledRowMutationForbidden,
  purchaseHasNoPayable,
  purchaseSupplierMismatch,
  resourceNotFound,
} from '../../errors/error.builder.js';

export const SUPPLIER_PAYMENT_INCLUDE = {
  supplier: { select: { name: true } },
  purchase: { select: { purchaseNo: true } },
} satisfies Prisma.SupplierPaymentInclude;

export type SupplierPaymentWithRefs = Prisma.SupplierPaymentGetPayload<{
  include: typeof SUPPLIER_PAYMENT_INCLUDE;
}>;

type Tx = Prisma.TransactionClient;

export function mapSupplierPaymentToResponse(
  row: SupplierPaymentWithRefs,
): ResponseSupplierPaymentDto {
  return {
    id: row.id,
    shopId: row.shopId,
    supplierId: row.supplierId,
    supplierName: row.supplier.name,
    purchaseId: row.purchaseId,
    purchaseNo: row.purchase?.purchaseNo ?? null,
    amount: Number(row.amount),
    paymentDate: row.paymentDate.toISOString().slice(0, 10),
    status: row.status,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    cancelledById: row.cancelledById,
    clientRequestId: row.clientRequestId,
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function purchaseRemaining(
  tx: Tx,
  dto: CreateSupplierPaymentDto,
  supplierName: string,
  shopId: string,
): Promise<bigint> {
  const purchaseId = dto.purchaseId;
  if (!purchaseId) {
    throw new BadRequestException('purchaseId is required');
  }
  const purchase = await tx.purchase.findFirst({
    where: { id: purchaseId, shopId },
    select: {
      id: true,
      purchaseNo: true,
      supplierId: true,
      totalAmount: true,
      status: true,
      isOpeningStock: true,
    },
  });
  if (!purchase) {
    throw new NotFoundException(resourceNotFound('Purchase', purchaseId));
  }
  if (purchase.supplierId !== dto.supplierId) {
    throw new BadRequestException(
      purchaseSupplierMismatch(purchase.purchaseNo, supplierName),
    );
  }
  if (purchase.status === RecordStatus.CANCELLED) {
    throw new BadRequestException(
      cancelledRowMutationForbidden('Purchase', purchase.purchaseNo),
    );
  }
  if (purchase.isOpeningStock) {
    throw new BadRequestException(purchaseHasNoPayable(purchase.purchaseNo));
  }

  const paid = await tx.supplierPayment.aggregate({
    where: {
      shopId,
      purchaseId: purchase.id,
      status: RecordStatus.ACTIVE,
    },
    _sum: { amount: true },
  });
  return purchase.totalAmount - (paid._sum.amount ?? 0n);
}

export async function openingRemaining(
  tx: Tx,
  supplierId: string,
  shopId: string,
  openingBalance: bigint,
): Promise<bigint> {
  const paid = await tx.supplierPayment.aggregate({
    where: {
      shopId,
      supplierId,
      purchaseId: null,
      status: RecordStatus.ACTIVE,
    },
    _sum: { amount: true },
  });
  return openingBalance - (paid._sum.amount ?? 0n);
}
