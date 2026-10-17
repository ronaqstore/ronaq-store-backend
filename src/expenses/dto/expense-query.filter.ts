import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class ExpenseQueryFilterDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'electricity',
    'Case-insensitive contains search on description or category name.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-000000000101',
    description: 'Only expenses under this category.',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'ACTIVE or CANCELLED. Omit for both.',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'CANCELLED'])
  status?: 'ACTIVE' | 'CANCELLED';

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on expenseDate, YYYY-MM-DD.',
  )
  from?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on expenseDate, YYYY-MM-DD.',
  )
  to?: string;

  @ApiPropertyOptional({
    example: 'expenseDate',
    description:
      'expenseDate | amount | createdAt | categoryName | status | description.',
  })
  @IsOptional()
  @IsIn([
    'expenseDate',
    'amount',
    'createdAt',
    'categoryName',
    'status',
    'description',
  ])
  sortBy?:
    | 'expenseDate'
    | 'amount'
    | 'createdAt'
    | 'categoryName'
    | 'status'
    | 'description' = 'expenseDate';

  @SortOrderPeriodQueryProperty('asc or desc.')
  sortOrder?: 'asc' | 'desc' = 'desc';
}
