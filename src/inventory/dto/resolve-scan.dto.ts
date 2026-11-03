import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ResponseProductDto } from '../../products/dto/response-product.dto.js';
import { ResponseInventoryUnitDto } from './response-inventory-unit.dto.js';

export class ResolveScanQueryDto {
  @ApiProperty({
    description: 'Scanned barcode, SKU, or IMEI to resolve',
    example: '354892091234567',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code: string;
}

export type ScanResolvedType = 'SERIALIZED' | 'QUANTITY' | 'SERIALIZED_PRODUCT';

export class ResponseResolveScanDto {
  @ApiProperty({ example: true })
  found: boolean;

  @ApiPropertyOptional({
    enum: ['SERIALIZED', 'QUANTITY', 'SERIALIZED_PRODUCT'],
  })
  type?: ScanResolvedType;

  @ApiPropertyOptional({ type: () => ResponseProductDto })
  product?: ResponseProductDto;

  @ApiPropertyOptional({ type: () => ResponseInventoryUnitDto })
  unit?: ResponseInventoryUnitDto;

  @ApiPropertyOptional({ example: 'NOT_IN_STOCK' })
  reason?: 'NOT_FOUND' | 'NOT_IN_STOCK' | 'INACTIVE';

  @ApiPropertyOptional({ example: 'Item not found in inventory' })
  message?: string;
}
