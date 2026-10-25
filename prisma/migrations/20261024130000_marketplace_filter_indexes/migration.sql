CREATE INDEX IF NOT EXISTS products_marketplace_price_idx
  ON products (default_selling_price ASC, published_at DESC NULLS LAST)
  WHERE is_published AND is_active;

CREATE INDEX IF NOT EXISTS products_marketplace_pta_idx
  ON products (pta_status, published_at DESC NULLS LAST)
  WHERE is_published AND is_active AND pta_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_marketplace_authenticity_idx
  ON products (authenticity, published_at DESC NULLS LAST)
  WHERE is_published AND is_active AND authenticity IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_shop_publish_active_idx
  ON products (shop_id, is_published, is_active);

CREATE INDEX IF NOT EXISTS inventory_units_in_stock_condition_idx
  ON inventory_units (product_id, condition)
  WHERE status = 'IN_STOCK';

CREATE INDEX IF NOT EXISTS shop_store_settings_display_name_trgm_idx
  ON shop_store_settings USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS shop_store_settings_city_trgm_idx
  ON shop_store_settings USING gin (city gin_trgm_ops)
  WHERE city IS NOT NULL;

CREATE INDEX IF NOT EXISTS shop_store_settings_enabled_updated_idx
  ON shop_store_settings (updated_at DESC)
  WHERE is_enabled;
