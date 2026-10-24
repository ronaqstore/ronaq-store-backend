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

export class StoreListQueryDto {
  @ApiPropertyOptional({ example: 1, description: '1-based page number.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 12,
    description: 'Rows per page. Maximum 50.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 12;

  @ApiPropertyOptional({
    example: 'mobile',
    description: 'Search stores by name, display name, address, or city.',
  })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 100))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    example: 'Lahore',
    description: 'Filter stores by city.',
  })
  @IsOptional()
  @Transform(({ value }) => sanitizeQueryText(value, 100))
  @IsString()
  @MaxLength(100)
  city?: string;
}
