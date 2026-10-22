import { Prisma } from '../../generated/prisma/client.js';
import type { ProductQueryFilterDto } from '../dto/product-query.filter.js';

export function buildProductListWhere(
  query: ProductQueryFilterDto,
  shopId: string,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { shopId };
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.brandId) where.brandId = query.brandId;
  if (query.trackingType) where.trackingType = query.trackingType;
  if (query.isActive !== undefined && query.isActive !== null) {
    where.isActive = query.isActive;
  }
  if (query.isPublished !== undefined && query.isPublished !== null) {
    where.isPublished = query.isPublished;
  }
  if (
    query.minSellingPrice !== undefined ||
    query.maxSellingPrice !== undefined
  ) {
    where.defaultSellingPrice = {};
    if (query.minSellingPrice !== undefined) {
      where.defaultSellingPrice.gte = query.minSellingPrice;
    }
    if (query.maxSellingPrice !== undefined) {
      where.defaultSellingPrice.lte = query.maxSellingPrice;
    }
  }
  if (query.search?.trim()) {
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { model: { contains: term, mode: 'insensitive' } },
      { sku: { contains: term, mode: 'insensitive' } },
      { barcode: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (query.inStockOnly) {
    where.AND = [
      {
        OR: [
          {
            trackingType: 'QUANTITY',
            stockLevel: { quantityOnHand: { gt: 0 } },
          },
          {
            trackingType: 'SERIALIZED',
            inventoryUnits: { some: { status: 'IN_STOCK' } },
          },
        ],
      },
    ];
  }

  return where;
}
