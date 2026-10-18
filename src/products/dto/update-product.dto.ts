import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateProductDto extends ProductOptionalSpecFieldsDto {
  @ApiPropertyOptional({
    description: 'Must stay unique inside the shop.',
    example: 'Galaxy A15',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Must be a category owned by the shop in the JWT.',
    example: '01924f0a-0000-7000-8000-000000000000',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Must be a brand owned by the shop in the JWT.',
    example: '01924f0a-0000-7000-8000-000000000001',
  })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    description:
      'QUANTITY or SERIALIZED. Only changeable while the product has NO purchase and NO sale history. Switching to QUANTITY creates a stock counter; switching to SERIALIZED requires the counter to be empty.',
    enum: ['QUANTITY', 'SERIALIZED'],
    example: 'QUANTITY',
  })
  @IsOptional()
  @IsIn(['QUANTITY', 'SERIALIZED'])
  trackingType?: 'QUANTITY' | 'SERIALIZED';

  @ApiPropertyOptional({
    description: 'Suggested cost in PAISA (Rs 1 = 100 paisa). Integer only.',
    example: 4500000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultPurchasePrice?: number;

  @ApiPropertyOptional({
    description:
      'Suggested selling price in PAISA (Rs 1 = 100 paisa). Integer only.',
    example: 699900,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultSellingPrice?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    description:
      'Set false to hide the product from pickers without deleting it.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
