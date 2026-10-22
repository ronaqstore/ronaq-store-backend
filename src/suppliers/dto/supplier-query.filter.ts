import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import { PartyBalanceRangeQueryFilterDto } from '../../common-dto/query/party-balance-range-query.filter.dto.js';
import {
  OptionalIsActiveQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

class SupplierQueryFilterBaseDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'mobiles',
    'Case-insensitive contains search across supplier name, phone and address. Supplier names are NOT unique, so a search may return several rows with the same name.',
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

  @ApiPropertyOptional({
    example: '17301',
    description: 'Case-insensitive contains filter on CNIC.',
  })
  @IsOptional()
  @IsString()
  cnic?: string;

  @OptionalIsActiveQueryProperty(
    '"true" returns only active suppliers. "false" returns only deactivated ones. Omit for both.',
  )
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'name',
    description:
      'Field to sort by. name | phone | createdAt | updatedAt | openingBalance | isActive.',
  })
  @IsOptional()
  @IsIn([
    'name',
    'phone',
    'createdAt',
    'updatedAt',
    'openingBalance',
    'isActive',
  ])
  sortBy?:
    | 'name'
    | 'phone'
    | 'createdAt'
    | 'updatedAt'
    | 'openingBalance'
    | 'isActive' = 'createdAt';
}

export class SupplierQueryFilterDto extends IntersectionType(
  SupplierQueryFilterBaseDto,
  PartyBalanceRangeQueryFilterDto,
) {}
