import { ApiProperty } from '@nestjs/swagger';

export class AttentionOverdueDebtorDto {
  @ApiProperty({ example: '0192e4...' })
  customerId: string;

  @ApiProperty({ example: 'Usman Tariq' })
  name: string;

  @ApiProperty({ description: 'Overdue Udhar in paisa', example: 750000 })
  amount: number;

  @ApiProperty({
    description: 'Days overdue past due date or sale date',
    example: 18,
  })
  overdueDays: number;
}

export class AttentionOverdueUdharDto {
  @ApiProperty({ example: 4 })
  count: number;

  @ApiProperty({
    description: 'Total overdue amount in paisa',
    example: 2500000,
  })
  totalAmount: number;

  @ApiProperty({ type: [AttentionOverdueDebtorDto] })
  topCustomers: AttentionOverdueDebtorDto[];
}

export class AttentionLowStockProductDto {
  @ApiProperty({ example: '0192e4...' })
  productId: string;

  @ApiProperty({ example: 'iPhone 12 Case' })
  name: string;

  @ApiProperty({ example: 0 })
  currentStock: number;

  @ApiProperty({ example: 5 })
  threshold: number;

  @ApiProperty({ example: 'QUANTITY' })
  trackingType: string;
}

export class AttentionReconciliationDto {
  @ApiProperty({ example: '2026-10-26T18:00:00.000Z' })
  reconciledAt: string;

  @ApiProperty({
    description: 'Difference (counted - system) in paisa',
    example: -50000,
  })
  difference: number;

  @ApiProperty({ example: 'Missing cash drawer note', nullable: true })
  reason: string | null;
}

export class AttentionResponseDto {
  @ApiProperty({ type: AttentionOverdueUdharDto })
  overdueUdhar: AttentionOverdueUdharDto;

  @ApiProperty({ type: [AttentionLowStockProductDto] })
  lowStock: AttentionLowStockProductDto[];

  @ApiProperty({ type: AttentionReconciliationDto, nullable: true })
  cashReconciliationDifference: AttentionReconciliationDto | null;

  @ApiProperty({
    description: 'Days until subscription ends if <= 7, else null',
    example: 5,
    nullable: true,
  })
  subscriptionDaysLeft: number | null;
}
