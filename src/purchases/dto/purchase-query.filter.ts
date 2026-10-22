import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { DocumentMoneyRangeQueryFilterDto } from '../../common-dto/query/document-money-range-query.filter.dto.js';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
  optionalBooleanQueryTransform,
} from '../../helpers/query-filter.decorators.js';

class PurchaseQueryFilterBaseDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'AB-771',
    'Case-insensitive contains search across purchase number, the supplier invoice reference and the supplier name.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-00000000000a',
    description: 'Only purchases from this supplier.',
  })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'ACTIVE or CANCELLED document status. Omit for both.',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'CANCELLED'])
  status?: 'ACTIVE' | 'CANCELLED';

  @ApiPropertyOptional({
    example: 'PAYABLE',
    description:
      'Payment state filter: PAID | PARTIAL | PAYABLE (due) | CANCELLED. CANCELLED matches document status.',
  })
  @IsOptional()
  @IsIn(['PAID', 'PARTIAL', 'PAYABLE', 'CANCELLED'])
  payStatus?: 'PAID' | 'PARTIAL' | 'PAYABLE' | 'CANCELLED';

  @ApiPropertyOptional({
    example: 'true',
    description:
      '"true" returns only opening-stock entries, "false" only real purchases. Omit for both.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(optionalBooleanQueryTransform('isOpeningStock'))
  @IsBoolean()
  isOpeningStock?: boolean;

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on purchaseDate, YYYY-MM-DD.',
  )
  from?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on purchaseDate, YYYY-MM-DD.',
  )
  to?: string;

  @ApiPropertyOptional({
    example: 'purchaseDate',
    description:
      'purchaseDate | purchaseNo | totalAmount | paid | outstanding.',
  })
  @IsOptional()
  @IsIn(['purchaseDate', 'purchaseNo', 'totalAmount', 'paid', 'outstanding'])
  sortBy?:
    'purchaseDate' | 'purchaseNo' | 'totalAmount' | 'paid' | 'outstanding' =
    'purchaseDate';

  @SortOrderPeriodQueryProperty('asc or desc')
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PurchaseQueryFilterDto extends IntersectionType(
  PurchaseQueryFilterBaseDto,
  DocumentMoneyRangeQueryFilterDto,
) {}
