import { Prisma } from '../../generated/prisma/client.js';
import { splitSearchTokens } from '../../helpers/tokenized-search.helper.js';

export type MarketplaceModelSearchRow = {
  brand: string;
  model: string;
  count: number | bigint;
  min_price: bigint | number | null;
  image_url: string | null;
};

export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function buildTokenMatchSql(token: string): Prisma.Sql {
  const pattern = `%${escapeLikePattern(token)}%`;
  return Prisma.sql`(
    p.name ILIKE ${pattern} ESCAPE '\'
    OR COALESCE(p.model, '') ILIKE ${pattern} ESCAPE '\'
    OR COALESCE(p.sku, '') ILIKE ${pattern} ESCAPE '\'
    OR b.name ILIKE ${pattern} ESCAPE '\'
  )`;
}

export function buildCityFilterSql(cityTokens: string[] | null): Prisma.Sql {
  if (!cityTokens || cityTokens.length === 0) {
    return Prisma.sql`TRUE`;
  }
  const parts = cityTokens.map(
    (token) => Prisma.sql`lower(ss.city) = lower(${token})`,
  );
  return Prisma.sql`(${Prisma.join(parts, ' OR ')})`;
}

export function buildMarketplaceModelSearchSql(
  q: string,
  cityTokens: string[] | null,
  limit: number,
): Prisma.Sql | null {
  const tokens = splitSearchTokens(q).slice(0, 6);
  if (tokens.length === 0) return null;

  const tokenFilters = tokens.map((token) => buildTokenMatchSql(token));
  const cityFilter = buildCityFilterSql(cityTokens);
  const safeLimit = Math.min(Math.max(limit, 1), 20);

  return Prisma.sql`
    SELECT
      b.name AS brand,
      COALESCE(NULLIF(btrim(p.model), ''), p.name) AS model,
      COUNT(*)::int AS count,
      MIN(p.default_selling_price) AS min_price,
      (
        array_agg(p.image_url ORDER BY p.published_at DESC NULLS LAST)
        FILTER (WHERE p.image_url IS NOT NULL)
      )[1] AS image_url
    FROM products p
    INNER JOIN brands b ON b.id = p.brand_id
    INNER JOIN shops s ON s.id = p.shop_id
    INNER JOIN shop_store_settings ss ON ss.shop_id = s.id
    WHERE p.is_active = true
      AND p.is_published = true
      AND p.published_at IS NOT NULL
      AND s.status = 'ACTIVE'
      AND ss.is_enabled = true
      AND ${cityFilter}
      AND ${Prisma.join(tokenFilters, ' AND ')}
    GROUP BY b.name, COALESCE(NULLIF(btrim(p.model), ''), p.name)
    ORDER BY COUNT(*) DESC, COALESCE(NULLIF(btrim(p.model), ''), p.name) ASC
    LIMIT ${safeLimit}
  `;
}
