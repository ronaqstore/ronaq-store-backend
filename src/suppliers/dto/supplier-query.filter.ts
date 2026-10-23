import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import { PartyBalanceRangeQueryFilterDto } from '../../common-dto/query/party-balance-range-query.filter.dto.js';
import {
  OptionalIsActiveQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

class SupplierQueryFilterBaseDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'mobiles',
    'Case-insensitive contains search across supplier name, phone, CNIC and address (including normalised phone / CNIC forms). Supplier names are NOT unique, so a search may return several rows with the same name.',
  )
  search?: string;

  @OptionalIsActiveQueryProperty(
    '"true" returns only active suppliers. "false" returns only deactivated ones. Omit for both.',
  )
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'name',
    description: 'Field to sort by. name | openingBalance.',
  })
  @IsOptional()
  @IsIn(['name', 'openingBalance'])
  sortBy?: 'name' | 'openingBalance' = 'name';
}

export class SupplierQueryFilterDto extends IntersectionType(
  SupplierQueryFilterBaseDto,
  PartyBalanceRangeQueryFilterDto,
) {}
