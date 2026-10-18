import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import {
  OptionalIsActiveQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class SupplierQueryFilterDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'mobiles',
    'Case-insensitive contains search across supplier name, phone and address. Supplier names are NOT unique, so a search may return several rows with the same name.',
  )
  search?: string;

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
