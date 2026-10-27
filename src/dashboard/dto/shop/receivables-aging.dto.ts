import { ApiProperty } from '@nestjs/swagger';

export class AgingBucketDto {
  @ApiProperty({ example: '0-7' })
  bucket: string;

  @ApiProperty({ example: '0–7 days' })
  label: string;

  @ApiProperty({ description: 'Outstanding amount in paisa', example: 1200000 })
  amount: number;

  @ApiProperty({
    description: 'Count of customers with balance in this bucket',
    example: 5,
  })
  customerCount: number;
}

export class TopDebtorDto {
  @ApiProperty({ example: '0192e4...' })
  customerId: string;

  @ApiProperty({ example: 'Ahmad Khan' })
  name: string;

  @ApiProperty({ example: '+923001234567', nullable: true })
  phone: string | null;

  @ApiProperty({ description: 'Outstanding amount in paisa', example: 450000 })
  amount: number;

  @ApiProperty({ description: 'Oldest overdue days', example: 45 })
  oldestDays: number;
}

export class ReceivablesAgingResponseDto {
  @ApiProperty({
    description: 'Total Udhar across all customers in paisa',
    example: 12500000,
  })
  totalUdhar: number;

  @ApiProperty({ type: [AgingBucketDto] })
  buckets: AgingBucketDto[];

  @ApiProperty({ type: [TopDebtorDto] })
  topDebtors: TopDebtorDto[];
}
