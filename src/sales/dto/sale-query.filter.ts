import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class SaleQueryFilterDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'S-0001',
    'Case-insensitive contains search across the sale number and the customer name.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-0000000000a7',
    description: 'Only sales of this customer.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'ACTIVE (default) or CANCELLED. Omit for both.',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'CANCELLED'])
  status?: 'ACTIVE' | 'CANCELLED';

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on saleDate, YYYY-MM-DD.',
  )
  from?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on saleDate, YYYY-MM-DD.',
  )
  to?: string;

  @ApiPropertyOptional({
    example: 'saleDate',
    description: 'saleDate | saleNo | totalAmount | createdAt | updatedAt.',
  })
  @IsOptional()
  @IsIn(['saleDate', 'saleNo', 'totalAmount', 'createdAt', 'updatedAt'])
  sortBy?: 'saleDate' | 'saleNo' | 'totalAmount' | 'createdAt' | 'updatedAt' =
    'saleDate';

  @SortOrderPeriodQueryProperty('asc or desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}
