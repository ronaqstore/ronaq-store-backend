import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeDto } from './range-response.dto.js';

export class SalesTrendBucketDto {
  @ApiProperty({ example: '2026-10-15' })
  date: string;

  @ApiProperty({ description: 'Sales in paisa', example: 1500000 })
  sales: number;

  @ApiProperty({ description: 'Gross profit in paisa', example: 450000 })
  grossProfit: number;

  @ApiProperty({ description: 'Net profit in paisa', example: 350000 })
  netProfit: number;

  @ApiProperty({ description: 'Active orders count', example: 8 })
  ordersCount: number;
}

export class SalesTrendTotalsDto {
  @ApiProperty({ description: 'Total sales in paisa', example: 25000000 })
  sales: number;

  @ApiProperty({ description: 'Total gross profit in paisa', example: 7500000 })
  grossProfit: number;

  @ApiProperty({ description: 'Total net profit in paisa', example: 5500000 })
  netProfit: number;

  @ApiProperty({ description: 'Total orders count', example: 120 })
  ordersCount: number;
}

export class SalesTrendResponseDto {
  @ApiProperty({ type: DashboardRangeDto })
  range: DashboardRangeDto;

  @ApiProperty({ type: [SalesTrendBucketDto] })
  series: SalesTrendBucketDto[];

  @ApiProperty({ type: [SalesTrendBucketDto], required: false })
  previousSeries?: SalesTrendBucketDto[];

  @ApiProperty({ type: SalesTrendTotalsDto })
  totals: SalesTrendTotalsDto;

  @ApiProperty({ type: SalesTrendTotalsDto, required: false })
  previousTotals?: SalesTrendTotalsDto;
}
