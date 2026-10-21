import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ProductOptionalSpecFieldsDto } from '../../common-dto/product/product-optional-spec-fields.dto.js';

export class CreateProductDto extends ProductOptionalSpecFieldsDto {
  @ApiProperty({
    description:
      'Product name shown in pickers. Same name is allowed for different variants (e.g. two "iPhone 7" with different color/storage). An exact match of name + variant details is still rejected.',
    example: 'iPhone 7',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    description:
      'UUID of a category owned by the shop in the JWT. Cannot point at another shop.',
    example: '01924f0a-0000-7000-8000-000000000000',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description:
      'UUID of a brand owned by the shop in the JWT. Cannot point at another shop.',
    example: '01924f0a-0000-7000-8000-000000000001',
  })
  @IsUUID()
  brandId: string;

  @ApiProperty({
    description:
      'QUANTITY = stock is a simple counter (covers, cables). SERIALIZED = every unit is tracked by its own IMEI (phones). QUANTITY products get a stock_levels row on creation; SERIALIZED ones do not. Locked once the product has any purchase or sale.',
    enum: ['QUANTITY', 'SERIALIZED'],
    example: 'SERIALIZED',
  })
  @IsIn(['QUANTITY', 'SERIALIZED'])
  trackingType: 'QUANTITY' | 'SERIALIZED';

  @ApiPropertyOptional({
    description:
      'Suggested cost in PAISA (Rs 1 = 100 paisa). Integer only. A hint for the purchase screen — the real cost is recorded on each purchase.',
    example: 4500000,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultPurchasePrice?: number;

  @ApiPropertyOptional({
    description:
      'Suggested selling price in PAISA (Rs 1 = 100 paisa). Integer only. A hint for the sale screen — the real price is decided per sale.',
    example: 699900,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultSellingPrice?: number;

  @ApiPropertyOptional({
    description:
      'Show a low-stock warning when on-hand quantity reaches this number. For SERIALIZED products it applies to the count of IN_STOCK units.',
    example: 3,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    description:
      'Set false to hide the product from pickers without deleting it.',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
