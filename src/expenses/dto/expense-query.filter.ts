import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { AmountRangeQueryFilterDto } from '../../common-dto/query/amount-range-query.filter.dto.js';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

class ExpenseQueryFilterBaseDto extends ListPaginationQueryFilterDto {
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
    example: 'bill',
    description: 'Case-insensitive contains filter on description.',
  })
  @IsOptional()
  @IsString()
  description?: string;

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
    description: 'expenseDate | amount | categoryName.',
  })
  @IsOptional()
  @IsIn(['expenseDate', 'amount', 'categoryName'])
  sortBy?: 'expenseDate' | 'amount' | 'categoryName' = 'expenseDate';

  @SortOrderPeriodQueryProperty('asc or desc.')
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class ExpenseQueryFilterDto extends IntersectionType(
  ExpenseQueryFilterBaseDto,
  AmountRangeQueryFilterDto,
) {}
