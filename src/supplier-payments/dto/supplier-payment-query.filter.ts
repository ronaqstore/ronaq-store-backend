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

class SupplierPaymentQueryFilterBaseDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'ABC Mobiles',
    'Case-insensitive contains search across the supplier name and the purchase number the payment was made against.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-00000000000a',
    description: 'Only payments made to this supplier.',
  })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-0000000000c1',
    description: 'Only payments made against this purchase.',
  })
  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  @ApiPropertyOptional({
    example: 'P-0047',
    description: 'Contains filter on linked purchase / bill number.',
  })
  @IsOptional()
  @IsString()
  purchaseNo?: string;

  @ApiPropertyOptional({
    example: 'Partial',
    description: 'Case-insensitive contains filter on notes.',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'ACTIVE (default) or CANCELLED. Omit for both.',
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
    description: 'paymentDate | amount | createdAt | updatedAt.',
  })
  @IsOptional()
  @IsIn([
    'paymentDate',
    'amount',
    'createdAt',
    'updatedAt',
    'supplierName',
    'purchaseNo',
  ])
  sortBy?:
    | 'paymentDate'
    | 'amount'
    | 'createdAt'
    | 'updatedAt'
    | 'supplierName'
    | 'purchaseNo' = 'paymentDate';

  @SortOrderPeriodQueryProperty('asc or desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class SupplierPaymentQueryFilterDto extends IntersectionType(
  SupplierPaymentQueryFilterBaseDto,
  AmountRangeQueryFilterDto,
) {}
