-- Store map pin for public storefront (Pakistan Places search from admin).
ALTER TABLE "shop_store_settings"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
