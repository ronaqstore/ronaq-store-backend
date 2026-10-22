import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import { PartyBalanceRangeQueryFilterDto } from '../../common-dto/query/party-balance-range-query.filter.dto.js';
import {
  OptionalIsActiveQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

class CustomerQueryFilterBaseDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'ali',
    'Case-insensitive contains search across customer name, phone and address (including normalised phone form).',
  )
  search?: string;

  @OptionalIsActiveQueryProperty(
    '"true" returns only active customers. "false" returns only deactivated ones. Omit for both.',
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

export class CustomerQueryFilterDto extends IntersectionType(
  CustomerQueryFilterBaseDto,
  PartyBalanceRangeQueryFilterDto,
) {}
