import { BadRequestException } from '@nestjs/common';
import { requiredFieldCannotBeNull } from '../../errors/error.builder.js';
import { googleMapsSearchUrl } from '../../app-configuration/google-maps.url.js';
import type { UpdateStoreSettingsDto } from '../dto/update-store-settings.dto.js';

export function normalizeLocationCoords(dto: UpdateStoreSettingsDto): void {
  const latTouched = dto.latitude !== undefined;
  const lngTouched = dto.longitude !== undefined;
  if (!latTouched && !lngTouched) return;

  const lat = dto.latitude ?? null;
  const lng = dto.longitude ?? null;
  const hasLat = lat != null && Number.isFinite(lat);
  const hasLng = lng != null && Number.isFinite(lng);

  if (hasLat !== hasLng) {
    throw new BadRequestException(
      requiredFieldCannotBeNull(
        'Store settings',
        hasLat ? 'longitude' : 'latitude',
      ),
    );
  }

  if (hasLat && hasLng) {
    dto.latitude = Number(lat);
    dto.longitude = Number(lng);
    if (dto.googleMapsUrl === undefined) {
      dto.googleMapsUrl = googleMapsSearchUrl(dto.latitude, dto.longitude);
    }
    return;
  }

  dto.latitude = null;
  dto.longitude = null;
  if (dto.googleMapsUrl === undefined) {
    dto.googleMapsUrl = null;
  }
}
