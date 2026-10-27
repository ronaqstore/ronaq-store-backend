-- Cancelled purchases VOID the unit but keep the IMEI for audit. Live
-- uniqueness must ignore VOIDED so the same device can be purchased again.

DROP INDEX IF EXISTS "inventory_units_shop_id_imei1_key";
DROP INDEX IF EXISTS "inventory_units_shop_id_imei2_key";

CREATE UNIQUE INDEX "inventory_units_shop_id_imei1_key"
  ON "inventory_units" ("shop_id", "imei1")
  WHERE "status" <> 'VOIDED';

CREATE UNIQUE INDEX "inventory_units_shop_id_imei2_key"
  ON "inventory_units" ("shop_id", "imei2")
  WHERE "status" <> 'VOIDED';

CREATE OR REPLACE FUNCTION inventory_units_imei_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'VOIDED' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM inventory_units u
    WHERE u.shop_id = NEW.shop_id AND u.id <> NEW.id
      AND u.status <> 'VOIDED'
      AND (u.imei1 IN (NEW.imei1, NEW.imei2) OR (u.imei2 IS NOT NULL AND u.imei2 IN (NEW.imei1, NEW.imei2)))
  ) THEN
    RAISE EXCEPTION 'IMEI already exists in this shop' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
