import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeDto } from './range-response.dto.js';

export class TopProductItemDto {
  @ApiProperty({ example: '0192e4...' })
  productId: string;

  @ApiProperty({ example: 'iPhone 13 128GB' })
  name: string;

  @ApiProperty({ example: 'Apple' })
  brand: string;

  @ApiProperty({ example: 'SERIALIZED', enum: ['SERIALIZED', 'QUANTITY'] })
  trackingType: string;

  @ApiProperty({
    description: 'Metric value (revenue/profit in paisa, or units count)',
    example: 12500000,
  })
  value: number;

  @ApiProperty({ description: 'Gross profit margin percent', example: 18.5 })
  marginPct: number;

  @ApiProperty({ description: 'Units sold in period', example: 12 })
  unitsSold: number;
}

export class TopProductsResponseDto {
  @ApiProperty({ type: DashboardRangeDto })
  range: DashboardRangeDto;

  @ApiProperty({ example: 'revenue' })
  metric: string;

  @ApiProperty({ type: [TopProductItemDto] })
  items: TopProductItemDto[];
}
