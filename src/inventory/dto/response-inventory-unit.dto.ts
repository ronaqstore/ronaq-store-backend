import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResponseInventoryUnitDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-0000000000d1' })
  id: string;

  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000101' })
  productId: string;

  @ApiProperty({ example: '111223344556677' })
  imei1: string;

  @ApiProperty({ example: '111223344556688' })
  imei2: string;

  @ApiProperty({ example: 'NEW', enum: ['NEW', 'USED'] })
  condition: string;

  @ApiProperty({ example: 'IN_STOCK' })
  status: string;

  @ApiPropertyOptional({ example: 4500000 })
  unitCost?: number;

  @ApiPropertyOptional({
    description: 'iPhone battery health 1–100, else null.',
    example: 97,
  })
  batteryHealth?: number | null;

  @ApiPropertyOptional({
    description: 'Unit ask price in paisa; null = use product default.',
    example: 5200000,
  })
  askingPrice?: number | null;

  @ApiPropertyOptional({
    description: 'Defect notes for dead/water/broken parts.',
    example: 'Water damage',
  })
  defectNotes?: string | null;

  @ApiPropertyOptional({
    description: 'Effective sell price: askingPrice or product default.',
    example: 5200000,
  })
  effectivePrice?: number | null;

  @ApiPropertyOptional({ example: '2026-03-15T10:00:00.000Z' })
  createdAt?: Date;

  @ApiPropertyOptional({ example: 'PO-0001' })
  purchaseNo?: string | null;

  @ApiPropertyOptional({ example: '2026-03-15' })
  purchaseDate?: string | null;

  @ApiPropertyOptional({ example: 'INV-9921' })
  supplierInvoiceRef?: string | null;

  @ApiPropertyOptional({ example: 'Ali Electronics' })
  supplierName?: string | null;

  @ApiPropertyOptional({ example: '03001234567' })
  supplierPhone?: string | null;

  @ApiPropertyOptional({ example: 'SO-0012' })
  saleNo?: string | null;

  @ApiPropertyOptional({ example: '2026-03-20' })
  saleDate?: string | null;

  @ApiPropertyOptional({ example: 'Bilal Khan' })
  customerName?: string | null;

  @ApiPropertyOptional({ example: '03007654321' })
  customerPhone?: string | null;

  @ApiPropertyOptional({ example: 5200000 })
  salePrice?: number | null;
}
