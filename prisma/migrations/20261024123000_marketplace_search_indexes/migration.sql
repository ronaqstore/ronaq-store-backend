CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_marketplace_feed_idx
  ON products (published_at DESC NULLS LAST)
  WHERE is_published AND is_active;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_model_trgm_idx
  ON products USING gin (model gin_trgm_ops)
  WHERE model IS NOT NULL;

CREATE INDEX IF NOT EXISTS brands_name_trgm_idx
  ON brands USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS shop_store_settings_enabled_city_idx
  ON shop_store_settings (is_enabled, lower(city))
  WHERE is_enabled;
