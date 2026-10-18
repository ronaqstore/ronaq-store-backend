import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const HTTP_URL_PATTERN = new RegExp('^https?:\\/\\/', 'i');

export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({
    description: 'Master switch. The public store is a 404 until this is true.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Store name shown on the storefront (2–100 chars).',
    example: 'Khalid Mobile Center',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @Length(2, 100)
  displayName?: string | null;

  @ApiPropertyOptional({
    description: 'Short intro story customers read on the storefront.',
    example: 'Genuine phones with warranty since 2015.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  about?: string | null;

  @ApiPropertyOptional({
    description:
      'Logo image URL. Prefer POST /store/settings/logo for uploads. http(s) only when set; null clears.',
    example: 'https://cdn.example.com/logo.png',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @Matches(HTTP_URL_PATTERN, { message: 'logoUrl must be an http(s) URL' })
  logoUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Cover banner image URL. http(s) only.',
    example: 'https://cdn.example.com/banner.png',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @Matches(HTTP_URL_PATTERN)
  bannerUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'WhatsApp number in international digits: 923001234567 (10–15 digits).',
    example: '923001234567',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @Matches(/^[0-9]{10,15}$/i)
  whatsappNumber?: string | null;

  @ApiPropertyOptional({
    description: 'Display phone number (free text allowed).',
    example: '0300-1234567',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 30)
  phoneNumber?: string | null;

  @ApiPropertyOptional({
    description: 'Street address shown on the storefront.',
    example: 'Shop 12, Shahra-e-Faisal, Karachi',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 300)
  address?: string | null;

  @ApiPropertyOptional({ description: 'City.', example: 'Karachi' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string | null;

  @ApiPropertyOptional({
    description: 'Google Maps link for directions. http(s) only.',
    example: 'https://example.com/maps?q=24.86,67.03',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @Matches(HTTP_URL_PATTERN)
  googleMapsUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Opening hours, free text.',
    example: 'Mon–Sat 11:00–21:00',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 200)
  openingHours?: string | null;

  @ApiPropertyOptional({
    description: 'Facebook page URL. http(s) only.',
    example: 'https://example.com/facebook/khalid.mobile',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @Matches(HTTP_URL_PATTERN)
  facebookUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Instagram profile URL. http(s) only.',
    example: 'https://example.com/instagram/khalid.mobile',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @Matches(HTTP_URL_PATTERN)
  instagramUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'When true the storefront shows the exact on-hand number; when false it only says In stock / Low / Out.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  showExactStock?: boolean;
}
