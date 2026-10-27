import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ShopDashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Predefined range',
    enum: [
      'today',
      'yesterday',
      '7d',
      '30d',
      'this_month',
      'last_month',
      'custom',
    ],
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'today',
    'yesterday',
    '7d',
    '30d',
    'this_month',
    'last_month',
    'custom',
  ])
  period?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'From date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-27',
    description: 'To date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({
    description: 'Include previous period comparison series/totals',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  @IsBoolean()
  compare?: boolean;

  @ApiPropertyOptional({
    description: 'Metric to rank top products by',
    enum: ['revenue', 'profit', 'units'],
    default: 'revenue',
  })
  @IsOptional()
  @IsString()
  @IsIn(['revenue', 'profit', 'units'])
  metric?: 'revenue' | 'profit' | 'units';

  @ApiPropertyOptional({ description: 'Limit items', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
