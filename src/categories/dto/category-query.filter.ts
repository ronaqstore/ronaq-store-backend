import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import {
  OptionalIsActiveQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class CategoryQueryFilterDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'sam',
    'Case-insensitive contains search across the category name.',
  )
  search?: string;

  @OptionalIsActiveQueryProperty(
    '"true" returns only active categories. "false" returns only deactivated ones. Omit for both.',
  )
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'name',
    description: 'Field to sort by. name.',
  })
  @IsOptional()
  @IsIn(['name'])
  sortBy = 'name' as const;
}
