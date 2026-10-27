-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'EXPIRED');

-- AlterTable
ALTER TABLE "shops" ADD COLUMN "subscription_status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING';
ALTER TABLE "shops" ADD COLUMN "trial_ends_at" TIMESTAMPTZ(3);

-- Backfill existing data
UPDATE "shops"
SET "trial_ends_at" = "created_at" + INTERVAL '30 days'
WHERE "trial_ends_at" IS NULL;

UPDATE "shops"
SET "subscription_status" = 'EXPIRED'
WHERE "subscription_ends_at" <= NOW();

UPDATE "shops"
SET "subscription_status" = 'ACTIVE'
WHERE "subscription_ends_at" > "created_at" + INTERVAL '30 days'
  AND "subscription_ends_at" > NOW();

