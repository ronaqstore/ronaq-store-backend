import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResponseInventoryUnitDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-0000000000d1' })
  id: string;

  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000101' })
  productId: string;

  @ApiProperty({ example: '111223344556677' })
  imei1: string;

  @ApiPropertyOptional({ example: null })
  imei2?: string | null;

  @ApiProperty({ example: 'NEW', enum: ['NEW', 'USED'] })
  condition: string;

  @ApiProperty({ example: 'IN_STOCK' })
  status: string;
}
