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
  MaxLength,
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

  @ApiPropertyOptional({
    description:
      'Publish / unpublish on the public store. Only an ACTIVE product can be published; the DB trigger maintains publishedAt.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description:
      'What customers read on the store. The private `description` field is never shown publicly. Blank clears it.',
    example: 'Brand new, box pack, 1 year warranty.',
    maxLength: 4000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  publicDescription?: string | null;

  @ApiPropertyOptional({
    description:
      'true hides the selling price on the store and shows "Contact for price" instead.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  contactForPrice?: boolean;

  @ApiPropertyOptional({
    description:
      'PTA status shown to customers. null clears it (accessories have none).',
    enum: ['PTA_APPROVED', 'NON_PTA'],
    example: 'PTA_APPROVED',
  })
  @IsOptional()
  @IsIn(['PTA_APPROVED', 'NON_PTA'])
  ptaStatus?: 'PTA_APPROVED' | 'NON_PTA' | null;
}
