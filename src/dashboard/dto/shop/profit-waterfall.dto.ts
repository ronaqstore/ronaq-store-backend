import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeDto } from './range-response.dto.js';

export class WaterfallStepDto {
  @ApiProperty({ example: 'Gross Sales' })
  name: string;

  @ApiProperty({ description: 'Step delta in paisa', example: 12000000 })
  amount: number;

  @ApiProperty({ description: 'Is a subtraction from revenue', example: false })
  isNegative: boolean;

  @ApiProperty({
    description: 'Running intermediate sum in paisa',
    example: 12000000,
  })
  runningTotal: number;
}

export class WaterfallTotalsDto {
  @ApiProperty({ description: 'Gross sales in paisa', example: 12500000 })
  grossSales: number;

  @ApiProperty({ description: 'COGS in paisa', example: 8000000 })
  costOfGoods: number;

  @ApiProperty({ description: 'Returns in paisa', example: 500000 })
  returns: number;

  @ApiProperty({ description: 'Expenses in paisa', example: 1500000 })
  expenses: number;

  @ApiProperty({ description: 'Net profit in paisa', example: 2500000 })
  netProfit: number;
}

export class ProfitWaterfallResponseDto {
  @ApiProperty({ type: DashboardRangeDto })
  range: DashboardRangeDto;

  @ApiProperty({ type: [WaterfallStepDto] })
  steps: WaterfallStepDto[];

  @ApiProperty({ type: WaterfallTotalsDto })
  totals: WaterfallTotalsDto;
}
