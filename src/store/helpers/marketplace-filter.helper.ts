import { Prisma } from '../../generated/prisma/client.js';
import { ShopStatus } from '../../generated/prisma/enums.js';
import { slugify } from '../../helpers/slug.helper.js';
import { resolveHubCityTokens } from './marketplace-hub.helper.js';
import type { MarketplaceProductsQueryDto } from '../dto/marketplace-products-query.dto.js';
import type {
  MarketplaceProductModelLabelRow,
  MarketplaceProductModelMatchRow,
} from '../services/marketplace.service.types.js';

function appendAnd(
  where: Prisma.ProductWhereInput,
  clause: Prisma.ProductWhereInput,
): void {
  const existing = where.AND;
  where.AND = [
    ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
    clause,
  ];
}

export function marketplaceShopWhere(
  city?: string | null,
): Prisma.ProductWhereInput['shop'] {
  const cityTokens = resolveHubCityTokens(city);
  return {
    status: ShopStatus.ACTIVE,
    subscriptionEndsAt: { gt: new Date() },
    storeSettings: {
      isEnabled: true,
      ...(cityTokens
        ? {
            OR: cityTokens.map((token) => ({
              city: { equals: token, mode: 'insensitive' as const },
            })),
          }
        : {}),
    },
  };
}

export function productModelLabel(
  row: MarketplaceProductModelLabelRow,
): string {
  return (row.model?.trim() || row.name).trim();
}

export function matchesModelKey(
  row: MarketplaceProductModelMatchRow,
  brandSlug: string,
  modelSlug: string,
): boolean {
  return (
    slugify(row.brand.name) === brandSlug &&
    slugify(productModelLabel(row)) === modelSlug
  );
}

export function applyMarketplaceListingFilters(
  where: Prisma.ProductWhereInput,
  query: MarketplaceProductsQueryDto,
): Prisma.ProductOrderByWithRelationInput[] {
  if (query.condition === 'NEW' || query.condition === 'USED') {
    if (query.condition === 'USED') {
      appendAnd(where, {
        trackingType: 'SERIALIZED',
        inventoryUnits: {
          some: {
            status: 'IN_STOCK',
            condition: 'USED',
          },
        },
      });
    } else {
      appendAnd(where, {
        OR: [
          {
            trackingType: 'SERIALIZED',
            inventoryUnits: {
              some: {
                status: 'IN_STOCK',
                condition: 'NEW',
              },
            },
          },
          { trackingType: 'QUANTITY' },
        ],
      });
    }
  }

  if (query.minPrice != null || query.maxPrice != null) {
    let minPrice = query.minPrice;
    let maxPrice = query.maxPrice;
    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      const swap = minPrice;
      minPrice = maxPrice;
      maxPrice = swap;
    }
    where.defaultSellingPrice = {
      ...(minPrice != null ? { gte: BigInt(minPrice) } : {}),
      ...(maxPrice != null ? { lte: BigInt(maxPrice) } : {}),
    };
  }

  if (query.ptaStatus) {
    where.ptaStatus = query.ptaStatus;
  }

  if (query.authenticity) {
    where.authenticity = query.authenticity;
  }

  if (query.sort === 'price_asc') {
    return [{ defaultSellingPrice: 'asc' }, { publishedAt: 'desc' }];
  }
  if (query.sort === 'price_desc') {
    return [{ defaultSellingPrice: 'desc' }, { publishedAt: 'desc' }];
  }
  return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
}
