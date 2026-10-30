DROP INDEX IF EXISTS "products_variant_key";

CREATE UNIQUE INDEX "products_variant_key"
  ON "products" (
    "shop_id",
    "brand_id",
    lower(btrim("name")),
    lower(btrim(coalesce("model", ''))),
    lower(btrim(coalesce("color", ''))),
    lower(btrim(coalesce("ram", ''))),
    lower(btrim(coalesce("storage", ''))),
    coalesce(ronaq_enum_label("pta_status"), ''),
    coalesce(ronaq_enum_label("authenticity"), '')
  )
  WHERE "is_active" = true;
