import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class InventoryAdjustmentQueryFilterDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'Charger',
    'Case-insensitive contains search across the product name and the movement reason.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-000000000101',
    description: 'Only stock changes for this product.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    example: 'DAMAGED',
    description:
      'Filter by movement type. With scope=manual (default), only ADJUSTMENT | DAMAGED | LOST. With scope=all, any inventory movement type.',
  })
  @IsOptional()
  @IsIn([
    'ADJUSTMENT',
    'DAMAGED',
    'LOST',
    'PURCHASE',
    'SALE',
    'SALE_CANCEL',
    'PURCHASE_CANCEL',
    'CUSTOMER_RETURN',
  ])
  type?:
    | 'ADJUSTMENT'
    | 'DAMAGED'
    | 'LOST'
    | 'PURCHASE'
    | 'SALE'
    | 'SALE_CANCEL'
    | 'PURCHASE_CANCEL'
    | 'CUSTOMER_RETURN';

  @ApiPropertyOptional({
    example: -2,
    description:
      'Exact quantityChange match (signed). Use negative values for write-offs.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  quantityChange?: number;

  @ApiPropertyOptional({
    example: 'water damage',
    description:
      'Case-insensitive reason filter. Any whitespace-separated word that appears in the reason matches the row.',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    example: 'all',
    description:
      'manual (default) = adjustment/damaged/lost only. all = full inventory movement ledger.',
  })
  @IsOptional()
  @IsIn(['manual', 'all'])
  scope?: 'manual' | 'all';

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on the movement timestamp, YYYY-MM-DD.',
  )
  from?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on the movement timestamp, YYYY-MM-DD.',
  )
  to?: string;

  @ApiPropertyOptional({
    example: 'createdAt',
    description: 'createdAt | quantityChange.',
  })
  @IsOptional()
  @IsIn(['createdAt', 'quantityChange'])
  sortBy?: 'createdAt' | 'quantityChange' = 'createdAt';

  @SortOrderPeriodQueryProperty('asc or desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}
