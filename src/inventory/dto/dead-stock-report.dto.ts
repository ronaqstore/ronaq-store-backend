import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeadStockBucketItemDto {
  @ApiProperty({
    example: '60+',
    enum: ['0-15', '16-30', '31-60', '60+'],
  })
  bucket: '0-15' | '16-30' | '31-60' | '60+';

  @ApiProperty({ example: '60+ days (Dead Stock)' })
  label: string;

  @ApiProperty({ example: 8 })
  count: number;

  @ApiProperty({
    description: 'Total purchase cost in integer paisa',
    example: 85000000,
  })
  costValue: number;
}

export class DeadStockSummaryDto {
  @ApiProperty({ example: 45 })
  totalInStockUnits: number;

  @ApiProperty({
    description: 'Total stock cost value in paisa',
    example: 450000000,
  })
  totalStockValue: number;

  @ApiProperty({ example: 8 })
  deadStockCount: number;

  @ApiProperty({
    description: 'Total dead stock (> 60 days) tied-up capital in paisa',
    example: 85000000,
  })
  deadStockCostValue: number;

  @ApiProperty({
    description: 'Average days on shelf across all in-stock units',
    example: 28,
  })
  averageDaysOnShelf: number;

  @ApiProperty({ type: () => [DeadStockBucketItemDto] })
  buckets: DeadStockBucketItemDto[];
}

export class DeadStockUnitItemDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000001' })
  id: string;

  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000002' })
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

  @ApiPropertyOptional({ example: 'PTA_APPROVED' })
  ptaStatus?: string | null;

  @ApiPropertyOptional({ example: 'IP14PM-256-PUR' })
  sku?: string | null;

  @ApiProperty({ example: '354892091234567' })
  imei1: string;

  @ApiPropertyOptional({ example: '354892091234568' })
  imei2?: string | null;

  @ApiProperty({ example: 'USED', enum: ['NEW', 'USED'] })
  condition: string;

  @ApiPropertyOptional({ example: 91 })
  batteryHealth?: number | null;

  @ApiPropertyOptional({ example: 'Minor back glass scratches' })
  defectNotes?: string | null;

  @ApiProperty({
    description: 'Purchase cost in integer paisa',
    example: 18500000,
  })
  unitCost: number;

  @ApiPropertyOptional({
    description: 'Asking selling price in integer paisa',
    example: 21000000,
  })
  askingPrice?: number | null;

  @ApiProperty({
    description: 'Effective selling price in integer paisa',
    example: 21000000,
  })
  effectivePrice: number;

  @ApiProperty({ example: '2026-08-15' })
  intakeDate: string;

  @ApiProperty({ example: 83 })
  daysOnShelf: number;

  @ApiProperty({
    example: '60+',
    enum: ['0-15', '16-30', '31-60', '60+'],
  })
  agingBucket: '0-15' | '16-30' | '31-60' | '60+';

  @ApiProperty({
    example: 'PURCHASE',
    enum: ['PURCHASE', 'CONSIGNMENT'],
  })
  sourceType: 'PURCHASE' | 'CONSIGNMENT';

  @ApiPropertyOptional({ example: 'Irfan Wholesale Peshawar' })
  sourceName?: string | null;

  @ApiPropertyOptional({ example: 'P-0014' })
  referenceNo?: string | null;
}

export class DeadStockItemsPaginationDto {
  @ApiProperty({ type: () => [DeadStockUnitItemDto] })
  items: DeadStockUnitItemDto[];

  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class ResponseDeadStockReportDto {
  @ApiProperty({ type: () => DeadStockSummaryDto })
  summary: DeadStockSummaryDto;

  @ApiProperty({ type: () => DeadStockItemsPaginationDto })
  pagination: DeadStockItemsPaginationDto;
}
