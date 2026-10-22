import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import { PartyBalanceRangeQueryFilterDto } from '../../common-dto/query/party-balance-range-query.filter.dto.js';
import {
  OptionalIsActiveQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

class CustomerQueryFilterBaseDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'ali',
    'Case-insensitive contains search across the customer name, and contains search across the phone.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: '0300',
    description: 'Contains filter on phone (also tries normalised form).',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: 'Lahore',
    description: 'Case-insensitive contains filter on address.',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @OptionalIsActiveQueryProperty(
    '"true" returns only active customers. "false" returns only deactivated ones. Omit for both.',
  )
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'name',
    description:
      'Field to sort by. name | createdAt | updatedAt | phone | isActive | openingBalance.',
  })
  @IsOptional()
  @IsIn([
    'name',
    'createdAt',
    'updatedAt',
    'phone',
    'isActive',
    'openingBalance',
  ])
  sortBy?:
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | 'phone'
    | 'isActive'
    | 'openingBalance' = 'createdAt';
}

export class CustomerQueryFilterDto extends IntersectionType(
  CustomerQueryFilterBaseDto,
  PartyBalanceRangeQueryFilterDto,
) {}
