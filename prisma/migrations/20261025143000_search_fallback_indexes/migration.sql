CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_search_keyset_idx
  ON products (created_at DESC, id DESC)
  WHERE is_published AND is_active;

CREATE INDEX IF NOT EXISTS products_shop_keyset_idx
  ON products (shop_id, created_at DESC, id DESC)
  WHERE is_published AND is_active;

CREATE INDEX IF NOT EXISTS products_price_keyset_idx
  ON products (default_selling_price, created_at DESC, id DESC)
  WHERE is_published AND is_active;

CREATE INDEX IF NOT EXISTS products_pta_keyset_idx
  ON products (pta_status, created_at DESC, id DESC)
  WHERE is_published AND is_active AND pta_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_search_fallback_trgm_idx
  ON products USING gin ((lower(name) || ' ' || COALESCE(lower(model), '')) gin_trgm_ops)
  WHERE is_published AND is_active;
