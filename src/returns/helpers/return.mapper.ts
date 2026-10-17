import type { Prisma } from '../../generated/prisma/client.js';
import type { ReturnCondition } from '../../generated/prisma/enums.js';
import { ResponseReturnDto } from '../dto/response-return.dto.js';
import { mapRefundRows } from '../../helpers/refund-list.mapper.js';
import { mapReturnItemRows } from '../../helpers/return-item-list.mapper.js';

export const SALE_RETURN_SELECT = {
  id: true,
  saleNo: true,
  status: true,
  subtotal: true,
  discount: true,
  totalAmount: true,
  customerId: true,
  customer: { select: { name: true } },
  items: {
    select: {
      id: true,
      productId: true,
      inventoryUnitId: true,
      quantity: true,
      unitPrice: true,
      product: { select: { name: true } },
      inventoryUnit: { select: { imei1: true, status: true } },
    },
  },
} satisfies Prisma.SaleSelect;

export type SaleForReturn = Prisma.SaleGetPayload<{
  select: typeof SALE_RETURN_SELECT;
}>;

export const RETURN_INCLUDE = {
  sale: { select: { saleNo: true } },
  customer: { select: { name: true } },
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
} satisfies Prisma.SaleReturnInclude;

export type ReturnWithRefs = Prisma.SaleReturnGetPayload<{
  include: typeof RETURN_INCLUDE;
}>;

export type PreparedReturnLine = {
  saleItemId: string;
  productId: string;
  productName: string;
  inventoryUnitId: string | null;
  imei: string | null;
  unitPrice: bigint;
  quantity: number;
  condition: ReturnCondition;
};

export type ReturnSettlement = {
  returnAmount: bigint;
  outstandingBefore: bigint;
  refundable: bigint;
  paidOnSale: bigint;
  refundedOnSale: bigint;
  priorReturns: bigint;
};

export function mapReturnToResponse(row: ReturnWithRefs): ResponseReturnDto {
  return {
    id: row.id,
    saleId: row.saleId,
    saleNo: row.sale.saleNo,
    customerId: row.customerId,
    customerName: row.customer?.name,
    returnDate: row.returnDate,
    reason: row.reason,
    returnAmount: Number(row.returnAmount),
    status: row.status,
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    items: mapReturnItemRows(row.items),
    refunds: mapRefundRows(row.refunds),
  };
}
