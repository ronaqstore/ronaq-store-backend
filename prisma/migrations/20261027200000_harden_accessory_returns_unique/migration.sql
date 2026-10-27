-- Enforce uniqueness of sale items within a single return
CREATE UNIQUE INDEX "return_items_return_id_sale_item_id_key"
  ON "return_items"("return_id", "sale_item_id");

