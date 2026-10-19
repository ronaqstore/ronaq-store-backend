-- Accessories: original vs copy (chargers, cables, airpods, covers, …)
CREATE TYPE "ProductAuthenticity" AS ENUM ('ORIGINAL', 'COPY');

ALTER TABLE "products" ADD COLUMN "authenticity" "ProductAuthenticity";
