import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
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
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
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
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HTTP_URL_PATTERN, { message: 'logoUrl must be an http(s) URL' })
  logoUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Cover banner image URL. http(s) only.',
    example: 'https://cdn.example.com/banner.png',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HTTP_URL_PATTERN)
  bannerUrl?: string | null;

  @ApiPropertyOptional({
    description:
      'WhatsApp mobile in local Pakistani form: 03XXXXXXXXX (also accepts 923…).',
    example: '03001234567',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(/^[0-9]{10,15}$/i)
  whatsappNumber?: string | null;

  @ApiPropertyOptional({
    description:
      'Public contact mobile in local Pakistani form: 03XXXXXXXXX. Rejected if the number is already in use.',
    example: '03001234567',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @Length(1, 30)
  phoneNumber?: string | null;

  @ApiPropertyOptional({
    description:
      'Full street address from Google Places (Pakistan). Shown on the storefront.',
    example: 'Zab Plaza, Timergara, Lower Dir, Khyber Pakhtunkhwa, Pakistan',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @Length(1, 500)
  address?: string | null;

  @ApiPropertyOptional({
    description: 'City.',
    example: 'Karachi',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @Length(1, 100)
  city?: string | null;

  @ApiPropertyOptional({
    description:
      'Map pin latitude from Places (Pakistan ≈ 23.5–37.2). Send with longitude, or null to clear.',
    example: 34.8266,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(23.5)
  @Max(37.2)
  latitude?: number | null;

  @ApiPropertyOptional({
    description:
      'Map pin longitude from Places (Pakistan ≈ 60.8–77.9). Send with latitude, or null to clear.',
    example: 71.8441,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(60.8)
  @Max(77.9)
  longitude?: number | null;

  @ApiPropertyOptional({
    description:
      'Human-readable place name from Google Places (shown in admin).',
    example: 'Pakistan Post Office Timergara',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @Length(1, 500)
  mapPlaceName?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional Maps link. Prefer latitude/longitude — the API auto-fills this from the pin.',
    example: 'https://www.google.com/maps/search/?api=1&query=34.8266,71.8441',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HTTP_URL_PATTERN)
  googleMapsUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Opening hours, free text.',
    example: 'Mon–Sat 11:00–21:00',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @Length(1, 200)
  openingHours?: string | null;

  @ApiPropertyOptional({
    description: 'Facebook page URL. http(s) only.',
    example: 'https://example.com/facebook/khalid.mobile',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Matches(HTTP_URL_PATTERN)
  facebookUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Instagram profile URL. http(s) only.',
    example: 'https://example.com/instagram/khalid.mobile',
    nullable: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
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
