import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DeadStockQueryFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by aging bucket',
    enum: ['ALL', '0-15', '16-30', '31-60', '60+'],
    default: 'ALL',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ALL', '0-15', '16-30', '31-60', '60+'])
  bucket?: 'ALL' | '0-15' | '16-30' | '31-60' | '60+';

  @ApiPropertyOptional({
    description: 'Filter by device condition',
    enum: ['ALL', 'NEW', 'USED'],
    default: 'ALL',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'NEW', 'USED'])
  condition?: 'ALL' | 'NEW' | 'USED';

  @ApiPropertyOptional({
    description: 'Filter by brand ID',
    example: '01924f0a-0000-7000-8000-000000000001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  brandId?: string;

  @ApiPropertyOptional({
    description: 'Search by phone name, model, SKU, or IMEI',
    example: 'iPhone 14',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort ordering',
    enum: ['ageDesc', 'ageAsc', 'costDesc', 'costAsc'],
    default: 'ageDesc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ageDesc', 'ageAsc', 'costDesc', 'costAsc'])
  sortBy?: 'ageDesc' | 'ageAsc' | 'costDesc' | 'costAsc';

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
