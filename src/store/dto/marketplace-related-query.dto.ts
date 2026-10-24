import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { sanitizeQueryText } from '../../helpers/sanitize-query-text.helper.js';

export class MarketplaceRelatedQueryDto {
  @ApiProperty({
    example: '01924f0a-0000-7000-8000-000000000010',
    description: 'Published product to find related accessories for.',
  })
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({
    example: 'timergara',
    description: 'Hub/city id. Omit or "all" for every city.',
  })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 80))
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 8, description: 'Max 24.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number = 8;
}
