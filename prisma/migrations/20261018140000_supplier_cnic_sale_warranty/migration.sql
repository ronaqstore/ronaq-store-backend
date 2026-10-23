-- Supplier identity for local purchases
ALTER TABLE "suppliers" ADD COLUMN "cnic" TEXT;

-- Shop warranty days on a sold phone line (USED units: 1|2|3; NEW = null = company warranty)
ALTER TABLE "sale_items" ADD COLUMN "warranty_days" INTEGER;

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_warranty_days_chk"
  CHECK ("warranty_days" IS NULL OR "warranty_days" IN (1, 2, 3));
