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

  @ApiPropertyOptional({ description: 'Google Maps link.' })
  googleMapsUrl?: string | null;

  @ApiPropertyOptional({ description: 'Opening hours text.' })
  openingHours?: string | null;

  @ApiPropertyOptional({ description: 'Facebook page URL.' })
  facebookUrl?: string | null;

  @ApiPropertyOptional({ description: 'Instagram profile URL.' })
  instagramUrl?: string | null;
}
