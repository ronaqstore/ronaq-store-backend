-- Create unique expression index on products to prevent duplicate product variants in a shop
CREATE UNIQUE INDEX IF NOT EXISTS "products_variant_key" ON "products"(
  "shop_id",
  lower(btrim("name")),
  lower(coalesce(btrim("model"), '')),
  lower(coalesce(btrim("color"), '')),
  lower(coalesce(btrim("ram"), '')),
  lower(coalesce(btrim("storage"), '')),
  coalesce("pta_status"::text, ''),
  coalesce("authenticity"::text, '')
);

