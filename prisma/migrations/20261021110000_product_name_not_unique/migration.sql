-- Allow multiple products with the same name in a shop (different variants).
DROP INDEX IF EXISTS "products_shop_id_name_key";

CREATE INDEX IF NOT EXISTS "products_shop_id_name_idx" ON "products"("shop_id", "name");
