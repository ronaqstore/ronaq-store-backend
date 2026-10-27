import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeDto } from './range-response.dto.js';

export class FlowKpiTotalsDto {
  @ApiProperty({ description: 'Net sales in paisa', example: 12000000 })
  sales: number;

  @ApiProperty({ description: 'Gross profit in paisa', example: 3500000 })
  grossProfit: number;

  @ApiProperty({ description: 'Net profit in paisa', example: 2500000 })
  netProfit: number;

  @ApiProperty({ description: 'Expenses in paisa', example: 1000000 })
  expenses: number;
}

export class BalanceKpiDto {
  @ApiProperty({ description: 'Cash in drawer in paisa', example: 4500000 })
  cashInHand: number;

  @ApiProperty({ description: 'Customer Udhar in paisa', example: 12000000 })
  customerUdhar: number;

  @ApiProperty({ description: 'Supplier payables in paisa', example: 8500000 })
  supplierPayable: number;

  @ApiProperty({ description: 'Count of low stock products', example: 4 })
  lowStockCount: number;
}

export class SparklinesDto {
  @ApiProperty({ type: [Number], example: [100, 200, 150] })
  sales: number[];

  @ApiProperty({ type: [Number], example: [30, 60, 45] })
  grossProfit: number[];

  @ApiProperty({ type: [Number], example: [20, 50, 35] })
  netProfit: number[];

  @ApiProperty({ type: [Number], example: [10, 10, 10] })
  expenses: number[];
}

export class ShopKpisResponseDto {
  @ApiProperty({ type: DashboardRangeDto })
  range: DashboardRangeDto;

  @ApiProperty({ type: FlowKpiTotalsDto })
  totals: FlowKpiTotalsDto;

  @ApiProperty({ type: FlowKpiTotalsDto })
  previousTotals: FlowKpiTotalsDto;

  @ApiProperty({ type: SparklinesDto })
  sparklines: SparklinesDto;

  @ApiProperty({ type: BalanceKpiDto })
  balance: BalanceKpiDto;
}
