import { Prisma } from '../../generated/prisma/client.js';
import { splitSearchTokens } from '../../helpers/tokenized-search.helper.js';
import {
  buildCityFilterSql,
  buildTokenMatchSql,
} from './marketplace-model-search.helper.js';

export type MarketplaceProductSearchRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  tracking_type: 'QUANTITY' | 'SERIALIZED';
  model: string | null;
  color: string | null;
  ram: string | null;
  storage: string | null;
  default_selling_price: bigint | number;
  low_stock_threshold: number;
  pta_status: string | null;
  authenticity: string | null;
  public_description: string | null;
  image_url: string | null;
  qty: number | bigint;
  slug: string;
  display_name: string;
  city: string | null;
  whatsapp_number: string | null;
  show_exact_stock: boolean;
};

export type MarketplaceProductSearchQuery = {
  q: string;
  cityTokens: string[] | null;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  ptaStatus?: string;
  authenticity?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  skip: number;
  take: number;
};

function buildOrderSql(
  sort?: 'newest' | 'price_asc' | 'price_desc',
): Prisma.Sql {
  if (sort === 'price_asc') {
    return Prisma.sql`p.default_selling_price ASC, p.published_at DESC NULLS LAST`;
  }
  if (sort === 'price_desc') {
    return Prisma.sql`p.default_selling_price DESC, p.published_at DESC NULLS LAST`;
  }
  return Prisma.sql`p.published_at DESC NULLS LAST, p.created_at DESC`;
}

function buildExtraFiltersSql(
  query: MarketplaceProductSearchQuery,
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (query.category?.trim()) {
    parts.push(Prisma.sql`lower(c.name) = lower(${query.category.trim()})`);
  }
  if (query.minPrice != null) {
    parts.push(Prisma.sql`p.default_selling_price >= ${query.minPrice}`);
  }
  if (query.maxPrice != null) {
    parts.push(Prisma.sql`p.default_selling_price <= ${query.maxPrice}`);
  }
  if (query.ptaStatus) {
    parts.push(Prisma.sql`p.pta_status::text = ${query.ptaStatus}`);
  }
  if (query.authenticity) {
    parts.push(Prisma.sql`p.authenticity::text = ${query.authenticity}`);
  }
  return Prisma.join(parts, ' AND ');
}

export function buildMarketplaceProductSearchSql(
  query: MarketplaceProductSearchQuery,
): Prisma.Sql | null {
  const tokens = splitSearchTokens(query.q).slice(0, 6);
  if (tokens.length === 0) return null;

  const tokenFilters = tokens.map((token) => buildTokenMatchSql(token));
  const cityFilter = buildCityFilterSql(query.cityTokens);
  const extraFilters = buildExtraFiltersSql(query);
  const orderBy = buildOrderSql(query.sort);
  const take = Math.min(Math.max(query.take, 1), 51);
  const skip = Math.max(query.skip, 0);

  return Prisma.sql`
    SELECT
      p.id,
      p.name,
      b.name AS brand,
      c.name AS category,
      p.tracking_type,
      p.model,
      p.color,
      p.ram,
      p.storage,
      p.default_selling_price,
      p.low_stock_threshold,
      p.pta_status,
      p.authenticity,
      p.public_description,
      p.image_url,
      CASE 
        WHEN p.tracking_type = 'QUANTITY' THEN COALESCE(sl.quantity_on_hand, 0)
        ELSE (
          SELECT COUNT(*)::int 
          FROM inventory_units u 
          WHERE u.product_id = p.id 
            AND u.status = 'IN_STOCK'
        )
      END AS qty,
      ss.slug,
      ss.display_name,
      ss.city,
      ss.whatsapp_number,
      ss.show_exact_stock
    FROM products p
    INNER JOIN brands b ON b.id = p.brand_id
    INNER JOIN categories c ON c.id = p.category_id
    INNER JOIN shops s ON s.id = p.shop_id
    INNER JOIN shop_store_settings ss ON ss.shop_id = s.id
    LEFT JOIN stock_levels sl ON sl.product_id = p.id
    WHERE p.is_active = true
      AND p.is_published = true
      AND p.published_at IS NOT NULL
      AND s.status = 'ACTIVE'
      AND ss.is_enabled = true
      AND ${cityFilter}
      AND ${Prisma.join(tokenFilters, ' AND ')}
      AND ${extraFilters}
    ORDER BY ${orderBy}
    LIMIT ${take}
    OFFSET ${skip}
  `;
}

export type LeanProductSearchInput = {
  q?: string;
  modelKey?: string;
  inStock?: boolean;
  condition?: string;
  brand?: string;
};

export function canUseLeanProductSearch(
  query: LeanProductSearchInput,
): boolean {
  if (!query.q?.trim() || query.q.trim().length < 2) return false;
  if (query.modelKey) return false;
  if (query.inStock !== undefined) return false;
  if (query.condition) return false;
  if (query.brand) return false;
  return true;
}
