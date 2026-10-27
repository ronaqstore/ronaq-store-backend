import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeDto } from './range-response.dto.js';

export class SalesMixTrackingDto {
  @ApiProperty({ example: 'SERIALIZED' })
  trackingType: string;

  @ApiProperty({ example: 'Phones (IMEI)' })
  label: string;

  @ApiProperty({ description: 'Revenue in paisa', example: 18000000 })
  revenue: number;

  @ApiProperty({ description: 'Profit in paisa', example: 3200000 })
  profit: number;

  @ApiProperty({ description: 'Units sold', example: 15 })
  units: number;

  @ApiProperty({ description: 'Percentage of total revenue', example: 75.5 })
  percentage: number;
}

export class SalesMixCategoryDto {
  @ApiProperty({ example: '0192e4...' })
  categoryId: string;

  @ApiProperty({ example: 'Smartphones' })
  name: string;

  @ApiProperty({ description: 'Revenue in paisa', example: 18000000 })
  revenue: number;

  @ApiProperty({ description: 'Profit in paisa', example: 3200000 })
  profit: number;

  @ApiProperty({ description: 'Percentage of total revenue', example: 75.5 })
  percentage: number;
}

export class SalesMixTotalsDto {
  @ApiProperty({ description: 'Total revenue in paisa', example: 24000000 })
  revenue: number;

  @ApiProperty({ description: 'Total profit in paisa', example: 5100000 })
  profit: number;
}

export class SalesMixResponseDto {
  @ApiProperty({ type: DashboardRangeDto })
  range: DashboardRangeDto;

  @ApiProperty({ type: [SalesMixTrackingDto] })
  byTrackingType: SalesMixTrackingDto[];

  @ApiProperty({ type: [SalesMixCategoryDto] })
  byCategory: SalesMixCategoryDto[];

  @ApiProperty({ type: SalesMixTotalsDto })
  totals: SalesMixTotalsDto;
}
