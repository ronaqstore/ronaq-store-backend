export interface StorefrontRevalidatePayload {
  tags: string[];
  secret: string;
}

export interface StorefrontRevalidateShopRef {
  shopId: string;
  slug?: string | null;
}
