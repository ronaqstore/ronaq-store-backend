import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import {
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

  @ApiPropertyOptional({
    example: 'name',
    description:
      'Field to sort by. name | createdAt | updatedAt | defaultSellingPrice.',
  })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'updatedAt', 'defaultSellingPrice'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'defaultSellingPrice' =
    'createdAt';
}
