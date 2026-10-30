-- Allow trade-in and repurchase of previously SOLD, DAMAGED, LOST or VOIDED phones.
-- Live uniqueness is guarded ONLY for active IN_STOCK inventory within the same shop.

DROP INDEX IF EXISTS "inventory_units_shop_id_imei1_key";
DROP INDEX IF EXISTS "inventory_units_shop_id_imei2_key";

CREATE UNIQUE INDEX "inventory_units_shop_id_imei1_key"
  ON "inventory_units" ("shop_id", "imei1")
  WHERE "status" = 'IN_STOCK';

CREATE UNIQUE INDEX "inventory_units_shop_id_imei2_key"
  ON "inventory_units" ("shop_id", "imei2")
  WHERE "status" = 'IN_STOCK';

CREATE OR REPLACE FUNCTION inventory_units_imei_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.status <> 'IN_STOCK' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM inventory_units u
    WHERE u.shop_id = NEW.shop_id AND u.id <> NEW.id
      AND u.status = 'IN_STOCK'
      AND (u.imei1 IN (NEW.imei1, NEW.imei2) OR (u.imei2 IS NOT NULL AND u.imei2 IN (NEW.imei1, NEW.imei2)))
  ) THEN
    RAISE EXCEPTION 'IMEI already exists in this shop' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_units_imei_guard_trg ON inventory_units;

CREATE TRIGGER inventory_units_imei_guard_trg
  BEFORE INSERT OR UPDATE OF status, imei1, imei2 ON inventory_units
  FOR EACH ROW EXECUTE FUNCTION inventory_units_imei_guard();

