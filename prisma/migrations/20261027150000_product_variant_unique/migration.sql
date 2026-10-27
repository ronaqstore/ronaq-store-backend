CREATE OR REPLACE FUNCTION ronaq_enum_label(val anyenum)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT $1::text;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "products_variant_key" ON "products"(
  "shop_id",
  lower(btrim("name")),
  lower(btrim(coalesce("model", ''))),
  lower(btrim(coalesce("color", ''))),
  lower(btrim(coalesce("ram", ''))),
  lower(btrim(coalesce("storage", ''))),
  coalesce(ronaq_enum_label("pta_status"), ''),
  coalesce(ronaq_enum_label("authenticity"), '')
);
