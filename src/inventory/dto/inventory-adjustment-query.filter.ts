import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
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
      'ADJUSTMENT | DAMAGED | LOST. When omitted the list only shows manual stock changes, never purchase/sale movements.',
  })
  @IsOptional()
  @IsIn(['ADJUSTMENT', 'DAMAGED', 'LOST'])
  type?: 'ADJUSTMENT' | 'DAMAGED' | 'LOST';

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
