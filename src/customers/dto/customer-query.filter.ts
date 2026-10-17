import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import {
  OptionalIsActiveQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class CustomerQueryFilterDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'ali',
    'Case-insensitive contains search across the customer name, and contains search across the phone.',
  )
  search?: string;

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
