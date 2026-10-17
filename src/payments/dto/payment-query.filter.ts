import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class PaymentQueryFilterDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'ali',
    'Case-insensitive contains search across the customer name and the payment notes.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-0000000000a7',
    description: 'Only payments of this customer.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-0000000001c1',
    description: 'Only payments applied to this sale.',
  })
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-0000000009e2',
    description:
      'Only rows of this receipt group — one request that split a payment across several sales shares one receiptGroupId.',
  })
  @IsOptional()
  @IsUUID()
  receiptGroupId?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description:
      'ACTIVE or CANCELLED. Omit for both — cancelled rows stay visible.',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'CANCELLED'])
  status?: 'ACTIVE' | 'CANCELLED';

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on paymentDate, YYYY-MM-DD.',
  )
  from?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on paymentDate, YYYY-MM-DD.',
  )
  to?: string;

  @ApiPropertyOptional({
    example: 'paymentDate',
    description:
      'paymentDate | amount | createdAt | updatedAt | customerName | method.',
  })
  @IsOptional()
  @IsIn([
    'paymentDate',
    'amount',
    'createdAt',
    'updatedAt',
    'customerName',
    'method',
  ])
  sortBy?:
    | 'paymentDate'
    | 'amount'
    | 'createdAt'
    | 'updatedAt'
    | 'customerName'
    | 'method' = 'paymentDate';

  @SortOrderPeriodQueryProperty('asc or desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}
