-- AlterTable expenses: add client_request_id and unique constraint
ALTER TABLE "expenses" ADD COLUMN "client_request_id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "expenses" ALTER COLUMN "client_request_id" DROP DEFAULT;
CREATE UNIQUE INDEX "expenses_shop_id_client_request_id_key" ON "expenses"("shop_id", "client_request_id");

-- AlterTable supplier_payments: add client_request_id and unique constraint
ALTER TABLE "supplier_payments" ADD COLUMN "client_request_id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "supplier_payments" ALTER COLUMN "client_request_id" DROP DEFAULT;
CREATE UNIQUE INDEX "supplier_payments_shop_id_client_request_id_key" ON "supplier_payments"("shop_id", "client_request_id");

-- AlterTable returns: add client_request_id and unique constraint
ALTER TABLE "returns" ADD COLUMN "client_request_id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "returns" ALTER COLUMN "client_request_id" DROP DEFAULT;
CREATE UNIQUE INDEX "returns_shop_id_client_request_id_key" ON "returns"("shop_id", "client_request_id");

-- AlterTable refunds: add client_request_id and unique constraint
ALTER TABLE "refunds" ADD COLUMN "client_request_id" UUID;
CREATE UNIQUE INDEX "refunds_shop_id_client_request_id_key" ON "refunds"("shop_id", "client_request_id");

-- AlterTable cash_movements: add client_request_id and unique constraint
ALTER TABLE "cash_movements" ADD COLUMN "client_request_id" UUID;
CREATE UNIQUE INDEX "cash_movements_shop_id_client_request_id_key" ON "cash_movements"("shop_id", "client_request_id");

