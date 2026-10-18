import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { OptionalListPaginationQueryFilterDto } from '../../common-dto/query/optional-list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class CashReconciliationQueryFilterDto extends OptionalListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty('closing', 'Matches the reason.')
  search?: string;

  @InclusiveDateFromQueryProperty(
    'Start of the range as an Asia/Karachi business day, YYYY-MM-DD.',
  )
  from?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive end of the range as an Asia/Karachi business day, YYYY-MM-DD.',
  )
  to?: string;

  @ApiPropertyOptional({
    enum: ['reconciledAt', 'systemCash', 'countedCash', 'difference'],
  })
  @IsOptional()
  @IsIn(['reconciledAt', 'systemCash', 'countedCash', 'difference'])
  sortBy?: string;

  @SortOrderPeriodQueryProperty()
  sortOrder?: 'asc' | 'desc';
}
