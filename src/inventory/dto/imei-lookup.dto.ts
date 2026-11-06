import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ImeiLookupQueryDto {
  @ApiProperty({
    description: '15-digit IMEI or IMEI2 to search',
    example: '354892091234567',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  imei: string;
}

export class ImeiDeviceInfoDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-0000000000d1' })
  id: string;

  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000101' })
  productId: string;

  @ApiProperty({ example: 'iPhone 14 Pro Max' })
  productName: string;

  @ApiPropertyOptional({ example: 'Apple' })
  brandName?: string | null;

  @ApiPropertyOptional({ example: 'Smartphones' })
  categoryName?: string | null;

  @ApiPropertyOptional({ example: 'A2894' })
  model?: string | null;

  @ApiPropertyOptional({ example: 'Deep Purple' })
  color?: string | null;

  @ApiPropertyOptional({ example: '256GB' })
  storage?: string | null;

  @ApiPropertyOptional({ example: '6GB' })
  ram?: string | null;

  @ApiPropertyOptional({ example: 'IP14PM-256-PUR' })
  sku?: string | null;

  @ApiPropertyOptional({ example: '194253401234' })
  barcode?: string | null;

  @ApiPropertyOptional({ example: 'PTA_APPROVED' })
  ptaStatus?: string | null;

  @ApiProperty({ example: '354892091234567' })
  imei1: string;

  @ApiPropertyOptional({ example: '354892091234568' })
  imei2?: string | null;

  @ApiProperty({ example: 'NEW', enum: ['NEW', 'USED'] })
  condition: string;

  @ApiProperty({
    example: 'IN_STOCK',
    enum: ['IN_STOCK', 'SOLD', 'DAMAGED', 'LOST', 'VOIDED'],
  })
  status: string;

  @ApiProperty({ example: 24500000 })
  unitCost: number;

  @ApiPropertyOptional({ example: 26000000 })
  askingPrice?: number | null;

  @ApiPropertyOptional({ example: 26000000 })
  effectivePrice?: number | null;

  @ApiPropertyOptional({ example: 98 })
  batteryHealth?: number | null;

  @ApiPropertyOptional({ example: 'Minor scratch near port' })
  defectNotes?: string | null;

  @ApiProperty({ example: '2026-10-01T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: 12 })
  daysOnShelf: number;
}

export class ImeiIntakeInfoDto {
  @ApiProperty({ example: 'PURCHASE', enum: ['PURCHASE', 'CONSIGNMENT'] })
  type: 'PURCHASE' | 'CONSIGNMENT';

  @ApiPropertyOptional({ example: '01924f0a-0000-7000-8000-0000000000p1' })
  purchaseId?: string | null;

  @ApiPropertyOptional({ example: 'P-0042' })
  purchaseNo?: string | null;

  @ApiPropertyOptional({ example: '2026-10-01' })
  purchaseDate?: string | null;

  @ApiPropertyOptional({ example: 'INV-8831' })
  supplierInvoiceRef?: string | null;

  @ApiPropertyOptional({ example: '01924f0a-0000-7000-8000-0000000000s1' })
  supplierId?: string | null;

  @ApiPropertyOptional({ example: 'Irfan Wholesale Peshawar' })
  supplierName?: string | null;

  @ApiPropertyOptional({ example: '03011234567' })
  supplierPhone?: string | null;

  @ApiPropertyOptional({ example: '01924f0a-0000-7000-8000-0000000000c1' })
  consignmentId?: string | null;

  @ApiPropertyOptional({ example: 'CON-0005' })
  consignmentNo?: string | null;

  @ApiPropertyOptional({ example: '2026-10-01' })
  intakeDate?: string | null;

  @ApiPropertyOptional({ example: 'Hamza Khan' })
  consignorName?: string | null;

  @ApiPropertyOptional({ example: '03331234567' })
  consignorPhone?: string | null;

  @ApiPropertyOptional({ example: 8500000 })
  agreedPayout?: number | null;
}

export class ImeiSaleInfoDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-0000000000s2' })
  saleId: string;

  @ApiProperty({ example: 'S-0105' })
  saleNo: string;

  @ApiProperty({ example: '2026-10-15' })
  saleDate: string;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'CANCELLED'] })
  saleStatus: string;

  @ApiPropertyOptional({ example: '01924f0a-0000-7000-8000-0000000000c2' })
  customerId?: string | null;

  @ApiPropertyOptional({ example: 'Zubair Khan' })
  customerName?: string | null;

  @ApiPropertyOptional({ example: '03029876543' })
  customerPhone?: string | null;

  @ApiProperty({ example: 26000000 })
  salePrice: number;

  @ApiProperty({ example: 1500000 })
  profitAmount: number;

  @ApiProperty({ example: 5.8 })
  profitMarginPercent: number;

  @ApiProperty({
    example: 'SHOP_WARRANTY',
    enum: ['SHOP_WARRANTY', 'OFFICIAL_WARRANTY', 'NO_WARRANTY'],
  })
  warrantyType: 'SHOP_WARRANTY' | 'OFFICIAL_WARRANTY' | 'NO_WARRANTY';

  @ApiPropertyOptional({ example: 3 })
  warrantyDays?: number | null;

  @ApiPropertyOptional({ example: '2026-10-18' })
  warrantyEndsAt?: string | null;

  @ApiPropertyOptional({ example: 0 })
  warrantyDaysLeft?: number | null;

  @ApiProperty({ example: false })
  isWarrantyActive: boolean;
}

export class ImeiTimelineEventDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-0000000000m1' })
  id: string;

  @ApiProperty({ example: '2026-10-01T10:00:00.000Z' })
  date: string;

  @ApiProperty({
    example: 'PURCHASE',
    enum: [
      'PURCHASE',
      'CONSIGNMENT_INTAKE',
      'SALE',
      'CUSTOMER_RETURN',
      'DAMAGED',
      'LOST',
      'ADJUSTMENT',
      'SALE_CANCEL',
      'PURCHASE_CANCEL',
      'CONSIGNMENT_RETURN',
    ],
  })
  type: string;

  @ApiProperty({ example: 'Purchased from Irfan Wholesale Peshawar' })
  title: string;

  @ApiProperty({ example: 'Bill # P-0042 at Rs 84,000' })
  description: string;

  @ApiPropertyOptional({ example: 'PURCHASE' })
  referenceType?: string | null;

  @ApiPropertyOptional({ example: '01924f0a-0000-7000-8000-0000000000p1' })
  referenceId?: string | null;

  @ApiPropertyOptional({ example: 'P-0042' })
  referenceNo?: string | null;
}

export class ResponseImeiLookupDto {
  @ApiProperty({ example: true })
  found: boolean;

  @ApiPropertyOptional({ type: () => ImeiDeviceInfoDto })
  device?: ImeiDeviceInfoDto;

  @ApiPropertyOptional({ type: () => ImeiIntakeInfoDto })
  intake?: ImeiIntakeInfoDto;

  @ApiPropertyOptional({ type: () => ImeiSaleInfoDto })
  latestSale?: ImeiSaleInfoDto | null;

  @ApiProperty({ type: () => [ImeiSaleInfoDto] })
  salesHistory: ImeiSaleInfoDto[];

  @ApiProperty({ type: () => [ImeiTimelineEventDto] })
  timeline: ImeiTimelineEventDto[];

  @ApiPropertyOptional({ example: 'Device not found in inventory' })
  message?: string;
}
