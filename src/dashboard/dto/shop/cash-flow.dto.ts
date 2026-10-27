import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeDto } from './range-response.dto.js';

export class CashFlowBucketDto {
  @ApiProperty({ example: '2026-10-15' })
  date: string;

  @ApiProperty({ description: 'Total Cash IN in paisa', example: 500000 })
  cashIn: number;

  @ApiProperty({ description: 'Total Cash OUT in paisa', example: 350000 })
  cashOut: number;

  @ApiProperty({ description: 'Net cash change in paisa', example: 150000 })
  netChange: number;

  @ApiProperty({
    description: 'Closing balance at end of bucket in paisa',
    example: 4500000,
  })
  closingBalance: number;
}

export class CashFlowTotalsDto {
  @ApiProperty({ description: 'Total Cash IN in paisa', example: 7500000 })
  cashIn: number;

  @ApiProperty({ description: 'Total Cash OUT in paisa', example: 5200000 })
  cashOut: number;

  @ApiProperty({ description: 'Net cash change in paisa', example: 2300000 })
  netChange: number;
}

export class CashFlowResponseDto {
  @ApiProperty({ type: DashboardRangeDto })
  range: DashboardRangeDto;

  @ApiProperty({
    description: 'Opening balance before range in paisa',
    example: 2200000,
  })
  openingBalance: number;

  @ApiProperty({
    description: 'Closing balance at end of range in paisa',
    example: 4500000,
  })
  closingBalance: number;

  @ApiProperty({ type: [CashFlowBucketDto] })
  series: CashFlowBucketDto[];

  @ApiProperty({ type: CashFlowTotalsDto })
  totals: CashFlowTotalsDto;
}
