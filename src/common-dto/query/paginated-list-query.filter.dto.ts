import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { ListPaginationQueryFilterDto } from './list-pagination-query.filter.dto.js';

export class PaginatedListQueryFilterDto extends ListPaginationQueryFilterDto {
  @ApiPropertyOptional({ example: 'desc', description: 'asc or desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
