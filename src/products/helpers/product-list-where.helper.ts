import { Prisma } from '../../generated/prisma/client.js';
import { buildTokenizedSearchAnd } from '../../helpers/tokenized-search.helper.js';
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

  const and: Prisma.ProductWhereInput[] = [
    ...buildTokenizedSearchAnd<Prisma.ProductWhereInput>(
      query.search,
      (token) => [
        { name: { contains: token, mode: 'insensitive' } },
        { model: { contains: token, mode: 'insensitive' } },
        { sku: { contains: token, mode: 'insensitive' } },
        { barcode: { contains: token, mode: 'insensitive' } },
      ],
    ),
  ];

  if (query.inStockOnly) {
    and.push({
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
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

export function productListNeedsStockJoin(
  query: ProductQueryFilterDto,
): boolean {
  return query.quantityOnHand !== undefined;
}

export function buildProductStockFilterSql(
  query: ProductQueryFilterDto,
  shopId: string,
): Prisma.Sql {
  const qty = query.quantityOnHand ?? 0;
  return Prisma.sql`
    SELECT p.id
    FROM products p
    LEFT JOIN stock_levels sl ON sl.product_id = p.id
    WHERE p.shop_id = ${shopId}::uuid
      AND (
        (
          p.tracking_type = 'QUANTITY'
          AND COALESCE(sl.quantity_on_hand, 0) = ${qty}
        )
        OR (
          p.tracking_type = 'SERIALIZED'
          AND (
            SELECT COUNT(*)::int
            FROM inventory_units u
            WHERE u.product_id = p.id
              AND u.status = 'IN_STOCK'
          ) = ${qty}
        )
      )
  `;
}
