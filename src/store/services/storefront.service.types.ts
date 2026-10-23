export type StorefrontSettingsProfile = {
  id?: string;
  slug: string;
  displayName: string;
  about: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  openingHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
};

export type StorefrontCatalogSettings = {
  shopId: string;
  showExactStock: boolean;
};
