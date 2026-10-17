import type { Prisma } from '../../generated/prisma/client.js';
import {
  ResponsePurchaseDto,
  ResponsePurchaseItemDto,
} from '../dto/response-purchase.dto.js';

export const PURCHASE_INCLUDE = {
  supplier: { select: { name: true } },
  items: {
    include: {
      product: { select: { name: true } },
      inventoryUnits: { select: { imei1: true } },
    },
  },
} satisfies Prisma.PurchaseInclude;

export type PurchaseWithLines = Prisma.PurchaseGetPayload<{
  include: typeof PURCHASE_INCLUDE;
}>;

export function mapPurchaseToResponse(
  row: PurchaseWithLines,
): ResponsePurchaseDto {
  return {
    id: row.id,
    shopId: row.shopId,
    supplierId: row.supplierId,
    supplierName: row.supplier.name,
    purchaseNo: row.purchaseNo,
    supplierInvoiceRef: row.supplierInvoiceRef,
    purchaseDate: row.purchaseDate.toISOString().slice(0, 10),
    totalAmount: Number(row.totalAmount),
    isOpeningStock: row.isOpeningStock,
    status: row.status,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    cancelledById: row.cancelledById,
    clientRequestId: row.clientRequestId,
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: row.items.map((item): ResponsePurchaseItemDto => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      unitCost: Number(item.unitCost),
      totalCost: Number(item.totalCost),
      imeis: item.inventoryUnits.map((unit) => unit.imei1),
    })),
  };
}
