import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResponsePurchasePaymentDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000401' })
  id: string;

  @ApiProperty({ description: 'In PAISA.', example: 500000 })
  amount: number;

  @ApiProperty({ description: 'YYYY-MM-DD.', example: '2026-10-07' })
  paymentDate: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;
}

export class ResponsePurchaseItemDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000201' })
  id: string;

  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000101' })
  productId: string;

  @ApiProperty({ example: 'Samsung A15 128GB' })
  productName: string;

  @ApiProperty({ example: 40 })
  quantity: number;

  @ApiProperty({
    description:
      'Cost of ONE unit at the time of purchase, in PAISA. Never changes later.',
    example: 50000,
  })
  unitCost: number;

  @ApiProperty({
    description: 'quantity × unitCost, in PAISA.',
    example: 2000000,
  })
  totalCost: number;

  @ApiPropertyOptional({
    description:
      'Phone units created from this line (SERIALIZED only). Each entry is IMEI1 + IMEI2.',
    example: [{ imei1: '111223344556677', imei2: '111223344556688' }],
  })
  phoneUnits?: Array<{
    imei1: string;
    imei2: string;
    condition?: string;
    batteryHealth?: number | null;
    askingPrice?: number | null;
    defectNotes?: string | null;
  }>;
}

export class ResponsePurchaseDto {
  @ApiProperty({
    example: '01924f0a-0000-7000-8000-00000000000a',
  })
  id: string;

  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000000' })
  shopId: string;

  @ApiProperty({ example: '01924f0a-0000-7000-8000-00000000000a' })
  supplierId: string;

  @ApiPropertyOptional({
    description:
      'Supplier name, resolved in one join so lists need no second call.',
    example: 'ABC Mobiles, Peshawar',
  })
  supplierName?: string;

  @ApiProperty({
    description: 'Our automatic number: P-0001, P-0002 …',
    example: 'P-0001',
  })
  purchaseNo: string;

  @ApiPropertyOptional({ example: 'AB-771' })
  supplierInvoiceRef?: string | null;

  @ApiProperty({ description: 'YYYY-MM-DD.', example: '2026-10-06' })
  purchaseDate: string;

  @ApiProperty({
    description: 'Σ line totalCost, computed by the server. In PAISA.',
    example: 29000000,
  })
  totalAmount: number;

  @ApiProperty({
    description: 'true = Day-0 stock entry. No payable, no cash movement.',
    example: false,
  })
  isOpeningStock: boolean;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiPropertyOptional({ example: null })
  cancelledAt?: Date | null;

  @ApiPropertyOptional({ example: null })
  cancelReason?: string | null;

  @ApiPropertyOptional({ example: null })
  cancelledById?: string | null;

  @ApiProperty({
    description: 'Idempotency key this purchase was saved under.',
    example: '01924f0a-0000-7000-8000-00000000beef',
  })
  clientRequestId: string;

  @ApiPropertyOptional({ example: 'Bought from the Sunday market' })
  notes?: string | null;

  @ApiProperty({ description: 'Owner who saved it.', example: 'user-uuid' })
  createdById: string;

  @ApiProperty({ example: '2026-10-06T09:20:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-10-06T09:20:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: [ResponsePurchaseItemDto] })
  items: ResponsePurchaseItemDto[];

  @ApiProperty({
    description:
      'ACTIVE + CANCELLED supplier payments linked to this bill. List UIs sum ACTIVE rows for Paid / Outstanding.',
    type: [ResponsePurchasePaymentDto],
  })
  payments: ResponsePurchasePaymentDto[];
}
