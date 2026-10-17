import type { ResponseReturnItemDto } from '../returns/dto/response-return.dto.js';

type ReturnItemRow = {
  id: string;
  saleItemId: string;
  inventoryUnitId: string | null;
  quantity: number;
  condition: string;
  saleItem: {
    productId: string;
    product: { name: string };
    inventoryUnit: { imei1: string } | null;
  };
};

export function mapReturnItemRows(
  items: ReturnItemRow[],
): ResponseReturnItemDto[] {
  return items.map((item) => ({
    id: item.id,
    saleItemId: item.saleItemId,
    inventoryUnitId: item.inventoryUnitId,
    imei: item.saleItem.inventoryUnit?.imei1 ?? null,
    productId: item.saleItem.productId,
    productName: item.saleItem.product.name,
    quantity: item.quantity,
    condition: item.condition,
  }));
}
