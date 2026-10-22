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

class SupplierPaymentQueryFilterBaseDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'P-0047',
    'Case-insensitive contains search across supplier name, notes and linked purchase / bill number.',
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
    description: 'paymentDate | amount | supplierName.',
  })
  @IsOptional()
  @IsIn(['paymentDate', 'amount', 'supplierName'])
  sortBy?: 'paymentDate' | 'amount' | 'supplierName' = 'paymentDate';

  @SortOrderPeriodQueryProperty('asc or desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class SupplierPaymentQueryFilterDto extends IntersectionType(
  SupplierPaymentQueryFilterBaseDto,
  AmountRangeQueryFilterDto,
) {}
