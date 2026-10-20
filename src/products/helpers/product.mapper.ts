import type { Prisma } from '../../generated/prisma/client.js';
import { ResponseProductDto } from '../dto/response-product.dto.js';

export const PRODUCT_INCLUDE = {
  category: { select: { name: true } },
  brand: { select: { name: true } },
  stockLevel: { select: { quantityOnHand: true } },
  images: {
    select: { url: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
    take: 5,
  },
  _count: { select: { inventoryUnits: { where: { status: 'IN_STOCK' } } } },
} as const;

export type ProductRow = Prisma.ProductGetPayload<{
  include: {
    category: { select: { name: true } };
    brand: { select: { name: true } };
    stockLevel: { select: { quantityOnHand: true } };
    images: { select: { url: true; sortOrder: true } };
    _count: { select: { inventoryUnits: { where: { status: 'IN_STOCK' } } } };
  };
}>;

export function mapProductToResponse(row: ProductRow): ResponseProductDto {
  const quantityOnHand =
    row.trackingType === 'QUANTITY'
      ? (row.stockLevel?.quantityOnHand ?? 0)
      : row._count.inventoryUnits;
  const imageUrls = row.images.map((image) => image.url);
  const coverUrl = row.imageUrl ?? imageUrls[0] ?? null;

  return {
    id: row.id,
    shopId: row.shopId,
    categoryId: row.categoryId,
    brandId: row.brandId,
    categoryName: row.category.name,
    brandName: row.brand.name,
    name: row.name,
    trackingType: row.trackingType,
    model: row.model,
    color: row.color,
    ram: row.ram,
    storage: row.storage,
    sku: row.sku,
    barcode: row.barcode,
    description: row.description,
    imageUrl: coverUrl,
    imageUrls,
    defaultPurchasePrice: Number(row.defaultPurchasePrice),
    defaultSellingPrice: Number(row.defaultSellingPrice),
    lowStockThreshold: row.lowStockThreshold,
    isActive: row.isActive,
    isPublished: row.isPublished,
    publicDescription: row.publicDescription,
    contactForPrice: row.contactForPrice,
    ptaStatus: row.ptaStatus,
    authenticity: row.authenticity,
    quantityOnHand,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
