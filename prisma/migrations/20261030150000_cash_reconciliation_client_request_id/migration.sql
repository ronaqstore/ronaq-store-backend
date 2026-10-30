-- AlterTable cash_reconciliations: add client_request_id for idempotent counts
ALTER TABLE "cash_reconciliations" ADD COLUMN "client_request_id" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "cash_reconciliations" ALTER COLUMN "client_request_id" DROP DEFAULT;
CREATE UNIQUE INDEX "cash_reconciliations_shop_id_client_request_id_key" ON "cash_reconciliations"("shop_id", "client_request_id");
