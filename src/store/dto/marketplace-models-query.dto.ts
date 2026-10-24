import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { sanitizeQueryText } from '../../helpers/sanitize-query-text.helper.js';

export class MarketplaceModelsQueryDto {
  @ApiPropertyOptional({
    example: 'iphone 7',
    description: 'Search text for model suggestions (min 2 chars).',
  })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 100))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    example: 'timergara',
    description: 'Hub id or city name. Omit or "all" for every city.',
  })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 80))
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({
    example: 8,
    description: 'Max model groups to return. Default 8, max 20.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 8;
}
