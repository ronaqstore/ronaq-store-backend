-- CreateEnum
CREATE TYPE "ConsignmentStatus" AS ENUM ('IN_CUSTODY', 'SOLD', 'SETTLED', 'RETURNED_TO_OWNER', 'CANCELLED');

-- AlterEnum
ALTER TYPE "CashMovementType" ADD VALUE 'CONSIGNMENT_PAYOUT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'CONSIGNMENT_INTAKE';
ALTER TYPE "InventoryMovementType" ADD VALUE 'CONSIGNMENT_RETURN';

-- AlterEnum
ALTER TYPE "ReferenceType" ADD VALUE 'CONSIGNMENT';

-- AlterTable
ALTER TABLE "inventory_units" ADD COLUMN     "consignment_id" UUID,
ALTER COLUMN "purchase_item_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "next_consignment_no" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "consignments" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "consignment_no" TEXT NOT NULL,
    "customer_id" UUID,
    "consignor_name" TEXT NOT NULL,
    "consignor_phone" TEXT NOT NULL,
    "consignor_cnic" TEXT,
    "product_id" UUID NOT NULL,
    "imei1" TEXT NOT NULL,
    "imei2" TEXT NOT NULL,
    "condition" "UnitCondition" NOT NULL DEFAULT 'USED',
    "battery_health" INTEGER,
    "defect_notes" TEXT,
    "agreed_payout" BIGINT NOT NULL,
    "target_selling_price" BIGINT,
    "status" "ConsignmentStatus" NOT NULL DEFAULT 'IN_CUSTODY',
    "intake_date" DATE NOT NULL,
    "sold_at" TIMESTAMPTZ(3),
    "sale_item_id" UUID,
    "sold_price" BIGINT,
    "settled_at" TIMESTAMPTZ(3),
    "settled_amount" BIGINT,
    "payout_method" "PaymentMethod",
    "payout_reference" TEXT,
    "returned_at" TIMESTAMPTZ(3),
    "return_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "client_request_id" UUID NOT NULL,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "settled_by_id" UUID,
    "returned_by_id" UUID,
    "cancelled_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consignments_sale_item_id_key" ON "consignments"("sale_item_id");

-- CreateIndex
CREATE INDEX "consignments_shop_id_status_idx" ON "consignments"("shop_id", "status");

-- CreateIndex
CREATE INDEX "consignments_shop_id_intake_date_idx" ON "consignments"("shop_id", "intake_date");

-- CreateIndex
CREATE INDEX "consignments_product_id_status_idx" ON "consignments"("product_id", "status");

-- CreateIndex
CREATE INDEX "consignments_customer_id_idx" ON "consignments"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "consignments_shop_id_consignment_no_key" ON "consignments"("shop_id", "consignment_no");

-- CreateIndex
CREATE UNIQUE INDEX "consignments_shop_id_client_request_id_key" ON "consignments"("shop_id", "client_request_id");

-- CreateIndex
CREATE INDEX "inventory_units_consignment_id_idx" ON "inventory_units"("consignment_id");

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_consignment_id_fkey" FOREIGN KEY ("consignment_id") REFERENCES "consignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Custom Business Constraints & Triggers for Consignments

-- 1. Check constraints on consignments
ALTER TABLE "consignments"
  ADD CONSTRAINT "consignments_payout_chk" CHECK ("agreed_payout" >= 0),
  ADD CONSTRAINT "consignments_target_price_chk" CHECK ("target_selling_price" IS NULL OR "target_selling_price" >= 0),
  ADD CONSTRAINT "consignments_settled_amount_chk" CHECK ("settled_amount" IS NULL OR "settled_amount" >= 0),
  ADD CONSTRAINT "consignments_sold_price_chk" CHECK ("sold_price" IS NULL OR "sold_price" >= 0),
  ADD CONSTRAINT "consignments_imei_diff_chk" CHECK ("imei1" <> "imei2"),
  ADD CONSTRAINT "consignments_settled_state_chk" CHECK (
    ("status" = 'SETTLED' AND "settled_at" IS NOT NULL AND "settled_by_id" IS NOT NULL AND "settled_amount" IS NOT NULL)
    OR ("status" <> 'SETTLED' AND "settled_at" IS NULL AND "settled_by_id" IS NULL AND "settled_amount" IS NULL)
  ),
  ADD CONSTRAINT "consignments_returned_state_chk" CHECK (
    ("status" = 'RETURNED_TO_OWNER' AND "returned_at" IS NOT NULL AND "returned_by_id" IS NOT NULL)
    OR ("status" <> 'RETURNED_TO_OWNER' AND "returned_at" IS NULL AND "returned_by_id" IS NULL)
  ),
  ADD CONSTRAINT "consignments_cancelled_state_chk" CHECK (
    ("status" = 'CANCELLED' AND "cancelled_at" IS NOT NULL AND "cancelled_by_id" IS NOT NULL AND "cancel_reason" IS NOT NULL)
    OR ("status" <> 'CANCELLED' AND "cancelled_at" IS NULL AND "cancelled_by_id" IS NULL AND "cancel_reason" IS NULL)
  );

-- 2. Inventory unit source constraint (must belong to either purchase_item or consignment)
ALTER TABLE "inventory_units"
  ADD CONSTRAINT "inventory_units_source_chk" CHECK (
    ("purchase_item_id" IS NOT NULL AND "consignment_id" IS NULL)
    OR ("purchase_item_id" IS NULL AND "consignment_id" IS NOT NULL)
  );

-- 3. Update shop counter check constraint
ALTER TABLE "shops" DROP CONSTRAINT IF EXISTS "shops_counters_chk";
ALTER TABLE "shops" ADD CONSTRAINT "shops_counters_chk" CHECK ("next_sale_no" >= 1 AND "next_purchase_no" >= 1 AND "next_consignment_no" >= 1);

-- 4. Update cash movements direction constraint to allow CONSIGNMENT_PAYOUT
ALTER TABLE "cash_movements" DROP CONSTRAINT IF EXISTS "cash_movements_direction_chk";
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_direction_chk" CHECK (
  ("type" IN ('OPENING_CASH','CUSTOMER_PAYMENT','OWNER_INVESTMENT') AND "direction" = 'IN')
  OR ("type" IN ('SUPPLIER_PAYMENT','EXPENSE','REFUND','OWNER_WITHDRAWAL','CONSIGNMENT_PAYOUT') AND "direction" = 'OUT')
  OR "type" IN ('REVERSAL','RECONCILIATION_ADJUSTMENT')
);

-- 5. Append-only / no hard delete trigger on consignments
DROP TRIGGER IF EXISTS "consignments_no_delete" ON "consignments";
CREATE TRIGGER "consignments_no_delete" BEFORE DELETE ON "consignments" FOR EACH ROW EXECUTE FUNCTION forbid_delete();
