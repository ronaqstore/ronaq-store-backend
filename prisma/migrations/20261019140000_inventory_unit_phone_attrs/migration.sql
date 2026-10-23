-- Dual IMEI required + per-unit battery / ask price / defect notes.

UPDATE "inventory_units"
SET "imei2" = 'LEGACY-' || "imei1"
WHERE "imei2" IS NULL;

ALTER TABLE "inventory_units"
  ALTER COLUMN "imei2" SET NOT NULL;

ALTER TABLE "inventory_units"
  ADD COLUMN IF NOT EXISTS "battery_health" INTEGER,
  ADD COLUMN IF NOT EXISTS "asking_price" BIGINT,
  ADD COLUMN IF NOT EXISTS "defect_notes" TEXT;
