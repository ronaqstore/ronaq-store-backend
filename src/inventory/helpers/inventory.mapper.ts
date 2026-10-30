import { Prisma } from '../../generated/prisma/client.js';
import { ResponseInventoryMovementDto } from '../dto/response-inventory-movement.dto.js';
import { ResponseInventoryUnitDto } from '../dto/response-inventory-unit.dto.js';

export const MOVEMENT_INCLUDE = {
  product: { select: { name: true } },
  inventoryUnit: { select: { imei1: true } },
} satisfies Prisma.InventoryMovementInclude;

export type MovementWithRefs = Prisma.InventoryMovementGetPayload<{
  include: typeof MOVEMENT_INCLUDE;
}>;

export const UNIT_INCLUDE = {
  product: {
    select: {
      defaultSellingPrice: true,
      brand: { select: { name: true } },
    },
  },
  purchaseItem: {
    include: {
      purchase: {
        include: {
          supplier: {
            select: { name: true, phone: true },
          },
        },
      },
    },
  },
  saleItems: {
    include: {
      sale: {
        include: {
          customer: {
            select: { name: true, phone: true },
          },
        },
      },
    },
    take: 1,
    orderBy: { id: 'desc' as const },
  },
} satisfies Prisma.InventoryUnitInclude;

export type UnitWithRefs = Prisma.InventoryUnitGetPayload<{
  include: typeof UNIT_INCLUDE;
}>;

export function mapMovementToResponse(
  row: MovementWithRefs,
): ResponseInventoryMovementDto {
  return {
    id: row.id,
    shopId: row.shopId,
    productId: row.productId,
    productName: row.product.name,
    inventoryUnitId: row.inventoryUnitId,
    imei: row.inventoryUnit?.imei1 ?? null,
    type: row.type,
    quantityChange: row.quantityChange,
    reason: row.reason,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    createdAt: row.createdAt,
  };
}

export function mapUnitToResponse(row: UnitWithRefs): ResponseInventoryUnitDto {
  const purchase = row.purchaseItem?.purchase;
  const supplier = purchase?.supplier;
  const latestSaleItem = row.saleItems?.[0];
  const sale = latestSaleItem?.sale;
  const customer = sale?.customer;
  const defaultSell = Number(row.product.defaultSellingPrice);
  const asking = row.askingPrice != null ? Number(row.askingPrice) : null;

  return {
    id: row.id,
    productId: row.productId,
    imei1: row.imei1,
    imei2: row.imei2,
    condition: row.condition,
    status: row.status,
    unitCost: Number(row.unitCost),
    batteryHealth: row.batteryHealth,
    askingPrice: asking,
    defectNotes: row.defectNotes,
    effectivePrice: asking ?? defaultSell,
    createdAt: row.createdAt,
    purchaseNo: purchase?.purchaseNo ?? null,
    purchaseDate: purchase?.purchaseDate
      ? purchase.purchaseDate.toISOString().slice(0, 10)
      : null,
    supplierInvoiceRef: purchase?.supplierInvoiceRef ?? null,
    supplierName: supplier?.name ?? null,
    supplierPhone: supplier?.phone ?? null,
    saleNo: sale?.saleNo ?? null,
    saleDate: sale?.saleDate ? sale.saleDate.toISOString().slice(0, 10) : null,
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone ?? null,
    salePrice: latestSaleItem ? Number(latestSaleItem.unitPrice) : null,
  };
}
