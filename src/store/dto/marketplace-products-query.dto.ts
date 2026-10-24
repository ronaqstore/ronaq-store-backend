import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { sanitizeQueryText } from '../../helpers/sanitize-query-text.helper.js';

const MAX_PRICE_PAISA = 5_000_000_000;

export class MarketplaceProductsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 24, description: 'Max 50.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 24;

  @ApiPropertyOptional({
    example: 'timergara',
    description:
      'Hub id or city name. Omit or pass "all" to include every city.',
  })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 80))
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'iphone 12' })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 100))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    example: 'apple--iphone-7',
    description:
      'Canonical model key. When set, returns every listing for that model (new + used) in the city scope.',
  })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 160))
  @IsString()
  @MaxLength(160)
  modelKey?: string;

  @ApiPropertyOptional({ example: 'Mobile Phones' })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 100))
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'Apple' })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 100))
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({
    example: 'NEW',
    enum: ['NEW', 'USED'],
    description: 'Phone condition. NEW = brand new units; USED = used units.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['NEW', 'USED'])
  condition?: 'NEW' | 'USED';

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Minimum selling price in paisa (e.g. 5000000 = Rs 50,000).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PAISA)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 15000000,
    description: 'Maximum selling price in paisa.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_PAISA)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: 'PTA_APPROVED',
    enum: ['PTA_APPROVED', 'NON_PTA', 'JV', 'BYPASS', 'MDM_BYPASS'],
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['PTA_APPROVED', 'NON_PTA', 'JV', 'BYPASS', 'MDM_BYPASS'])
  ptaStatus?: 'PTA_APPROVED' | 'NON_PTA' | 'JV' | 'BYPASS' | 'MDM_BYPASS';

  @ApiPropertyOptional({
    example: 'ORIGINAL',
    enum: ['ORIGINAL', 'COPY'],
    description: 'Accessory authenticity.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['ORIGINAL', 'COPY'])
  authenticity?: 'ORIGINAL' | 'COPY';

  @ApiPropertyOptional({
    example: 'newest',
    enum: ['newest', 'price_asc', 'price_desc'],
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: 'newest' | 'price_asc' | 'price_desc';
}
