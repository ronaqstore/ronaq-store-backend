import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class ReturnQueryFilterDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'wrong charger',
    'Case-insensitive contains search across the sale number, the customer name and the reason.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-0000000000aa',
    description: 'Only returns against this sale.',
  })
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-0000000000a7',
    description: 'Only returns of this customer.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on returnDate (PKT business day).',
  )
  from?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on returnDate (PKT business day).',
  )
  to?: string;

  @ApiPropertyOptional({
    example: 'returnDate',
    description: 'returnDate | returnAmount.',
  })
  @IsOptional()
  @IsIn(['returnDate', 'returnAmount'])
  sortBy?: 'returnDate' | 'returnAmount' = 'returnDate';

  @SortOrderPeriodQueryProperty('asc or desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}
