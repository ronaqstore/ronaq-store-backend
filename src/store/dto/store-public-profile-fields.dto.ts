import { ApiPropertyOptional } from '@nestjs/swagger';

export class StorePublicProfileFieldsDto {
  @ApiPropertyOptional({ description: 'Short intro story.' })
  about?: string | null;

  @ApiPropertyOptional({ description: 'Logo image URL.' })
  logoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Cover banner image URL.' })
  bannerUrl?: string | null;

  @ApiPropertyOptional({
    description: 'WhatsApp number (international digits).',
  })
  whatsappNumber?: string | null;

  @ApiPropertyOptional({ description: 'Display phone number.' })
  phoneNumber?: string | null;

  @ApiPropertyOptional({ description: 'Street address.' })
  address?: string | null;

  @ApiPropertyOptional({ description: 'City.' })
  city?: string | null;

  @ApiPropertyOptional({
    description: 'Map pin latitude (WGS84).',
    example: 34.8266,
    nullable: true,
  })
  latitude?: number | null;

  @ApiPropertyOptional({
    description: 'Map pin longitude (WGS84).',
    example: 71.8441,
    nullable: true,
  })
  longitude?: number | null;

  @ApiPropertyOptional({
    description: 'Human-readable map place name (from Places search).',
    example: 'Pakistan Post Office Timergara',
    nullable: true,
  })
  mapPlaceName?: string | null;

  @ApiPropertyOptional({
    description: 'Google Maps link (auto-built from pin when set).',
  })
  googleMapsUrl?: string | null;

  @ApiPropertyOptional({ description: 'Opening hours text.' })
  openingHours?: string | null;

  @ApiPropertyOptional({ description: 'Facebook page URL.' })
  facebookUrl?: string | null;

  @ApiPropertyOptional({ description: 'Instagram profile URL.' })
  instagramUrl?: string | null;
}
