import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { AmountRangeQueryFilterDto } from '../../common-dto/query/amount-range-query.filter.dto.js';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

class PaymentQueryFilterBaseDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'S-0047',
    'Case-insensitive contains search across customer name, payment notes and linked sale number.',
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
    example: 'CASH',
    description: 'Payment method filter: CASH | JAZZCASH | EASYPAISA | BANK.',
  })
  @IsOptional()
  @IsIn(['CASH', 'JAZZCASH', 'EASYPAISA', 'BANK'])
  method?: 'CASH' | 'JAZZCASH' | 'EASYPAISA' | 'BANK';

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
    description: 'paymentDate | amount | customerName.',
  })
  @IsOptional()
  @IsIn(['paymentDate', 'amount', 'customerName'])
  sortBy?: 'paymentDate' | 'amount' | 'customerName' = 'paymentDate';

  @SortOrderPeriodQueryProperty('asc or desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaymentQueryFilterDto extends IntersectionType(
  PaymentQueryFilterBaseDto,
  AmountRangeQueryFilterDto,
) {}
