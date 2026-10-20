import { ApiProperty } from '@nestjs/swagger';

export class ResponseCustomerDto {
  @ApiProperty({
    description: 'UUID v7 of this customer row.',
    example: '01924f0a-0000-0000-0000-000000000000',
  })
  id: string;

  @ApiProperty({
    description:
      'Shop that owns this customer. Every customer is scoped per-tenant.',
    example: '01924f0a-0000-0000-0000-000000000000',
  })
  shopId: string;

  @ApiProperty({ example: 'Ali Khan' })
  name: string;

  @ApiProperty({ example: '03001234567', nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ example: 'Hayatabad, Peshawar', nullable: true, type: String })
  address: string | null;

  @ApiProperty({
    example: 'Regular customer, pays at month end',
    nullable: true,
    type: String,
  })
  notes: string | null;

  @ApiProperty({
    description:
      'Old Udhar the customer owed before using the app, in paisa (Rs 100 = 10000). This is NOT the current Udhar; current Udhar is calculated from sales and payments.',
    example: 5000000,
  })
  openingBalance: number;

  @ApiProperty({
    description:
      'Live Udhar in PAISA: openingBalance + Σ ACTIVE sales − Σ ACTIVE payments − Σ ACTIVE returns + refunds. Derived on read; never stored.',
    example: 5500000,
  })
  currentBalance: number;

  @ApiProperty({
    example: true,
    description: 'Deactivated customers are hidden from dropdowns.',
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Row creation timestamp, UTC.',
    example: '2026-10-05T09:20:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last edit timestamp, UTC.',
    example: '2026-10-05T09:20:00.000Z',
  })
  updatedAt: Date;
}
