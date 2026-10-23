import { ApiProperty } from '@nestjs/swagger';

export class UnpaidSaleDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-0000000001c1' })
  id: string;

  @ApiProperty({ example: 'S-0001' })
  saleNo: string;

  @ApiProperty({ description: 'YYYY-MM-DD.', example: '2026-10-06' })
  saleDate: string;

  @ApiProperty({ description: 'Sale total, in PAISA.', example: 4500000 })
  totalAmount: number;

  @ApiProperty({
    description: 'Active payments already on this sale, in PAISA.',
    example: 4000000,
  })
  paidAmount: number;

  @ApiProperty({
    description:
      'Still owed on this sale after payments, returns and refunds, in PAISA.',
    example: 500000,
  })
  remaining: number;
}

export class CustomerReceivableDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-0000000000a7' })
  customerId: string;

  @ApiProperty({ example: 'Usama Khan' })
  customerName: string;

  @ApiProperty({
    description: 'Day-0 Udhar typed when the customer was created, in PAISA.',
    example: 2000000,
  })
  openingBalance: number;

  @ApiProperty({
    description: 'openingBalance minus active opening-balance payments.',
    example: 2000000,
  })
  openingRemaining: number;

  @ApiProperty({
    description: 'Σ ACTIVE sale totals for this customer, in PAISA.',
    example: 4500000,
  })
  totalSales: number;

  @ApiProperty({
    description: 'Σ ACTIVE payments for this customer, in PAISA.',
    example: 4000000,
  })
  totalPaid: number;

  @ApiProperty({
    description:
      'Live Udhar: openingBalance + ACTIVE sales − ACTIVE payments − ACTIVE returns + refunds. Derived, never stored.',
    example: 2500000,
  })
  receivable: number;

  @ApiProperty({ type: [UnpaidSaleDto] })
  unpaidSales: UnpaidSaleDto[];
}
