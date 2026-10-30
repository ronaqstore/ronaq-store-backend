import type { UpdateStoreSettingsDto } from '../dto/update-store-settings.dto.js';

export function buildStoreSettingsUpdate(
  dto: UpdateStoreSettingsDto,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
  if (dto.displayName !== undefined) data.displayName = dto.displayName?.trim();
  if (dto.about !== undefined) {
    data.about = dto.about === null ? null : dto.about.trim() || null;
  }
  if (dto.logoUrl !== undefined) {
    data.logoUrl = dto.logoUrl === null ? null : dto.logoUrl.trim() || null;
  }
  if (dto.bannerUrl !== undefined) {
    data.bannerUrl =
      dto.bannerUrl === null ? null : dto.bannerUrl.trim() || null;
  }
  if (dto.whatsappNumber !== undefined) {
    data.whatsappNumber =
      dto.whatsappNumber === null ? null : dto.whatsappNumber.trim() || null;
  }
  if (dto.phoneNumber !== undefined) {
    data.phoneNumber =
      dto.phoneNumber === null ? null : dto.phoneNumber.trim() || null;
  }
  if (dto.address !== undefined) {
    data.address = dto.address === null ? null : dto.address.trim() || null;
  }
  if (dto.city !== undefined) {
    data.city = dto.city === null ? null : dto.city.trim() || null;
  }
  if (dto.latitude !== undefined) data.latitude = dto.latitude;
  if (dto.longitude !== undefined) data.longitude = dto.longitude;
  if (dto.mapPlaceName !== undefined) {
    data.mapPlaceName =
      dto.mapPlaceName === null ? null : dto.mapPlaceName.trim() || null;
  }
  if (dto.googleMapsUrl !== undefined) {
    data.googleMapsUrl =
      dto.googleMapsUrl === null ? null : dto.googleMapsUrl.trim() || null;
  }
  if (dto.openingHours !== undefined) {
    data.openingHours =
      dto.openingHours === null ? null : dto.openingHours.trim() || null;
  }
  if (dto.facebookUrl !== undefined) {
    data.facebookUrl =
      dto.facebookUrl === null ? null : dto.facebookUrl.trim() || null;
  }
  if (dto.instagramUrl !== undefined) {
    data.instagramUrl =
      dto.instagramUrl === null ? null : dto.instagramUrl.trim() || null;
  }
  if (dto.showExactStock !== undefined)
    data.showExactStock = dto.showExactStock;
  return data;
}
