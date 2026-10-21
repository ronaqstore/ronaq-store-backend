import type { UpdateStoreSettingsDto } from '../dto/update-store-settings.dto.js';

export function buildStoreSettingsUpdate(
  dto: UpdateStoreSettingsDto,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
  if (dto.displayName !== undefined) data.displayName = dto.displayName?.trim();
  if (dto.about !== undefined) data.about = dto.about?.trim() || null;
  if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl?.trim() || null;
  if (dto.bannerUrl !== undefined)
    data.bannerUrl = dto.bannerUrl?.trim() || null;
  if (dto.whatsappNumber !== undefined)
    data.whatsappNumber = dto.whatsappNumber || null;
  if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber || null;
  if (dto.address !== undefined) data.address = dto.address?.trim() || null;
  if (dto.city !== undefined) data.city = dto.city?.trim() || null;
  if (dto.latitude !== undefined) data.latitude = dto.latitude;
  if (dto.longitude !== undefined) data.longitude = dto.longitude;
  if (dto.googleMapsUrl !== undefined)
    data.googleMapsUrl = dto.googleMapsUrl?.trim() || null;
  if (dto.openingHours !== undefined)
    data.openingHours = dto.openingHours?.trim() || null;
  if (dto.facebookUrl !== undefined)
    data.facebookUrl = dto.facebookUrl?.trim() || null;
  if (dto.instagramUrl !== undefined)
    data.instagramUrl = dto.instagramUrl?.trim() || null;
  if (dto.showExactStock !== undefined)
    data.showExactStock = dto.showExactStock;
  return data;
}
