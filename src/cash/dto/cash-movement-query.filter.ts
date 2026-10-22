import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AmountRangeQueryFilterDto } from '../../common-dto/query/amount-range-query.filter.dto.js';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';
import type {
  CashDirection,
  CashMovementType,
} from '../../generated/prisma/enums.js';

class CashMovementQueryFilterBaseDto extends ListPaginationQueryFilterDto {
  @ApiPropertyOptional({
    example: 'EXPENSE',
    description:
      'OPENING_CASH | CUSTOMER_PAYMENT | SUPPLIER_PAYMENT | EXPENSE | REVERSAL | REFUND | OWNER_INVESTMENT | OWNER_WITHDRAWAL | RECONCILIATION_ADJUSTMENT. Omit for all.',
  })
  @IsOptional()
  @IsIn([
    'OPENING_CASH',
    'CUSTOMER_PAYMENT',
    'SUPPLIER_PAYMENT',
    'EXPENSE',
    'REVERSAL',
    'REFUND',
    'OWNER_INVESTMENT',
    'OWNER_WITHDRAWAL',
    'RECONCILIATION_ADJUSTMENT',
  ])
  type?: CashMovementType;

  @ApiPropertyOptional({
    example: 'OUT',
    description: 'IN or OUT. Omit for both.',
  })
  @IsOptional()
  @IsIn(['IN', 'OUT'])
  direction?: CashDirection;

  @OptionalSearchQueryProperty(
    'rent',
    'Case-insensitive contains on note, or partial amount (e.g. 150 matches Rs 150,000).',
  )
  search?: string;

  @ApiPropertyOptional({
    example: 'rent',
    description: 'Case-insensitive contains filter on note only.',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on movementDate (business day, PKT), YYYY-MM-DD.',
  )
  from?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on movementDate (business day, PKT), YYYY-MM-DD.',
  )
  to?: string;

  @ApiPropertyOptional({
    example: 'movementDate',
    description: 'movementDate | amount | createdAt.',
  })
  @IsOptional()
  @IsIn(['movementDate', 'amount', 'createdAt'])
  sortBy?: 'movementDate' | 'amount' | 'createdAt' = 'movementDate';

  @SortOrderPeriodQueryProperty('asc or desc.')
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class CashMovementQueryFilterDto extends IntersectionType(
  CashMovementQueryFilterBaseDto,
  AmountRangeQueryFilterDto,
) {}
