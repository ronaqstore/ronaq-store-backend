import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import {
  OptionalBooleanQueryProperty,
  OptionalIsActiveQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class ProductQueryFilterDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'a15',
    'Case-insensitive contains search across name, model, sku and barcode.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-000000000000',
    description: 'Only products in this category.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-000000000001',
    description: 'Only products of this brand.',
  })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    example: 'QUANTITY',
    enum: ['QUANTITY', 'SERIALIZED'],
    description: 'Only products tracked this way.',
  })
  @IsOptional()
  @IsIn(['QUANTITY', 'SERIALIZED'])
  trackingType?: 'QUANTITY' | 'SERIALIZED';

  @OptionalIsActiveQueryProperty(
    '"true" returns only active products. "false" returns only deactivated ones. Omit for both.',
  )
  isActive?: boolean;

  @OptionalBooleanQueryProperty(
    'isPublished',
    '"true" returns only products published to the online store. "false" returns only unpublished. Omit for both.',
  )
  isPublished?: boolean;

  @OptionalBooleanQueryProperty(
    'inStockOnly',
    '"true" returns only products with quantity on hand (QUANTITY stock_levels > 0, or SERIALIZED units in IN_STOCK). Omit for all.',
  )
  inStockOnly?: boolean;

  @ApiPropertyOptional({
    example: 5,
    description:
      'Exact on-hand stock match. QUANTITY uses stock_levels; SERIALIZED uses IN_STOCK unit count.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantityOnHand?: number;

  @ApiPropertyOptional({
    example: 5000000,
    description:
      'Minimum default selling price in PAISA (inclusive). Rs 50,000 = 5000000.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSellingPrice?: number;

  @ApiPropertyOptional({
    example: 15000000,
    description:
      'Maximum default selling price in PAISA (inclusive). Rs 150,000 = 15000000.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxSellingPrice?: number;

  @ApiPropertyOptional({
    example: 'name',
    description: 'Field to sort by. name | defaultSellingPrice.',
  })
  @IsOptional()
  @IsIn(['name', 'defaultSellingPrice'])
  sortBy?: 'name' | 'defaultSellingPrice' = 'name';
}
