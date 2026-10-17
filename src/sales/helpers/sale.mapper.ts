import type { Prisma } from '../../generated/prisma/client.js';
import {
  ResponsePaymentDto,
  ResponseSaleDto,
  ResponseSaleItemDto,
} from '../dto/response-sale.dto.js';
import { ResponseReturnDto } from '../../returns/dto/response-return.dto.js';
import { mapRefundRows } from '../../helpers/refund-list.mapper.js';
import { mapReturnItemRows } from '../../helpers/return-item-list.mapper.js';

export const SALE_INCLUDE = {
  customer: { select: { name: true } },
  items: {
    include: {
      product: { select: { name: true } },
      inventoryUnit: { select: { imei1: true } },
    },
  },
  payments: { orderBy: { createdAt: 'asc' as const } },
  saleReturns: {
    orderBy: { returnDate: 'asc' as const },
    include: {
      items: {
        include: {
          saleItem: {
            select: {
              productId: true,
              product: { select: { name: true } },
              inventoryUnit: { select: { imei1: true } },
            },
          },
        },
      },
      refunds: { orderBy: { createdAt: 'asc' as const } },
    },
  },
} satisfies Prisma.SaleInclude;

export type SaleWithLines = Prisma.SaleGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

export function mapSaleToResponse(row: SaleWithLines): ResponseSaleDto {
  return {
    id: row.id,
    shopId: row.shopId,
    customerId: row.customerId,
    customerName: row.customer?.name,
    saleNo: row.saleNo,
    saleDate: row.saleDate,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    totalAmount: Number(row.totalAmount),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    status: row.status,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    cancelledById: row.cancelledById,
    clientRequestId: row.clientRequestId,
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map((item): ResponseSaleItemDto => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      inventoryUnitId: item.inventoryUnitId,
      imei: item.inventoryUnit?.imei1 ?? null,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      unitCost: Number(item.unitCost),
      total: Number(item.total),
    })),
    payments: row.payments.map((payment): ResponsePaymentDto => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentDate: payment.paymentDate,
      method: payment.method,
      status: payment.status,
    })),
    returns: row.saleReturns.map((ret): ResponseReturnDto => ({
      id: ret.id,
      saleId: ret.saleId,
      saleNo: row.saleNo,
      customerId: ret.customerId,
      customerName: row.customer?.name,
      returnDate: ret.returnDate,
      reason: ret.reason,
      returnAmount: Number(ret.returnAmount),
      status: ret.status,
      notes: ret.notes,
      createdById: ret.createdById,
      createdAt: ret.createdAt,
      updatedAt: ret.updatedAt,
      items: mapReturnItemRows(ret.items),
      refunds: mapRefundRows(ret.refunds),
    })),
  };
}
