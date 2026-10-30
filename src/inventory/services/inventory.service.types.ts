export type InventoryAdjustmentProductShape = {
  name: string;
  trackingType: string;
};

export type InventoryProductRef = {
  id: string;
  name: string;
};

export type InventoryAdjustmentOutcome =
  { kind: 'created'; message: string } | { kind: 'nochange'; message: string };
