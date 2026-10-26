-- DropIndex
DROP INDEX "brands_name_trgm_idx";

-- DropIndex
DROP INDEX "products_name_trgm_idx";

-- DropIndex
DROP INDEX "shop_store_settings_display_name_trgm_idx";

-- CreateIndex
CREATE INDEX "inventory_units_product_id_status_condition_idx" ON "inventory_units"("product_id", "status", "condition");

-- CreateIndex
CREATE INDEX "products_is_published_is_active_published_at_idx" ON "products"("is_published", "is_active", "published_at" DESC);

-- CreateIndex
CREATE INDEX "shop_store_settings_is_enabled_city_idx" ON "shop_store_settings"("is_enabled", "city");

-- RenameIndex
ALTER INDEX "products_shop_publish_active_idx" RENAME TO "products_shop_id_is_published_is_active_idx";
