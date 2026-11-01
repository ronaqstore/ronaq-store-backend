import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ConsignmentStatus,
  PaymentMethod,
  UnitCondition,
} from '../../generated/prisma/enums.js';

export class ResponseConsignmentDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000001' })
  id: string;

  @ApiProperty({ example: 'CON-0001' })
  consignmentNo: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-000000000002',
    nullable: true,
  })
  customerId: string | null;

  @ApiPropertyOptional({ example: 'Muhammad Ali', nullable: true })
  customerName: string | null;

  @ApiProperty({ example: 'Muhammad Ali' })
  consignorName: string;

  @ApiProperty({ example: '03001234567' })
  consignorPhone: string;

  @ApiPropertyOptional({ example: '17301-1234567-1', nullable: true })
  consignorCnic: string | null;

  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000003' })
  productId: string;

  @ApiProperty({ example: 'iPhone 13 128GB Midnight' })
  productName: string;

  @ApiProperty({ example: '356938035643803' })
  imei1: string;

  @ApiProperty({ example: '356938035643804' })
  imei2: string;

  @ApiProperty({ enum: UnitCondition, example: UnitCondition.USED })
  condition: UnitCondition;

  @ApiPropertyOptional({ example: 85, nullable: true })
  batteryHealth: number | null;

  @ApiPropertyOptional({ example: 'Minor scratch on edge', nullable: true })
  defectNotes: string | null;

  @ApiProperty({ example: 5000000, description: 'Agreed payout in PAISA' })
  agreedPayout: number;

  @ApiPropertyOptional({
    example: 5500000,
    nullable: true,
    description: 'Target asking price in PAISA',
  })
  targetSellingPrice: number | null;

  @ApiProperty({
    enum: ConsignmentStatus,
    example: ConsignmentStatus.IN_CUSTODY,
  })
  status: ConsignmentStatus;

  @ApiProperty({ example: '2026-11-01' })
  intakeDate: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-000000000004',
    nullable: true,
  })
  inventoryUnitId: string | null;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-000000000005',
    nullable: true,
  })
  saleItemId: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  soldAt: Date | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Sold price in PAISA',
  })
  soldPrice: number | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  settledAt: Date | null;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Settled payout in PAISA',
  })
  settledAmount: number | null;

  @ApiPropertyOptional({ enum: PaymentMethod, example: null, nullable: true })
  payoutMethod: PaymentMethod | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  payoutReference: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  returnedAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  returnReason: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  cancelledAt: Date | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  cancelReason: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  notes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
