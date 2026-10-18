import { ApiPropertyOptional } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { OptionalListPaginationQueryFilterDto } from '../../common-dto/query/optional-list-pagination-query.filter.dto.js';
import type { ReportPeriod } from '../../helpers/date.helper.js';
import {
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class ReportQueryFilterDto extends OptionalListPaginationQueryFilterDto {
  @ApiPropertyOptional({
    enum: ['today', 'week', 'month', 'custom'],
    description:
      'today | week (Monday start) | month | custom. Ignored when from/to are passed.',
  })
  @IsOptional()
  @IsIn(['today', 'week', 'month', 'custom'])
  period?: ReportPeriod;

  @ApiPropertyOptional({
    description:
      'Custom range start, Asia/Karachi business date. Implies a custom range.',
    example: '2026-10-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({
    description: 'Custom range end (inclusive), Asia/Karachi business date.',
    example: '2026-10-31',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @OptionalSearchQueryProperty(
    '',
    'Free-text search. Column depends on the report.',
  )
  search?: string;

  @ApiPropertyOptional({
    description:
      'Sort column — whitelisted per report (e.g. saleDate, totalAmount, name). Defaults listed per report.',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @SortOrderPeriodQueryProperty()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    enum: ['csv'],
    description:
      'format=csv returns a text/csv download instead of JSON. PDF is a later ticket — the same plumbing.',
  })
  @IsOptional()
  @IsIn(['csv', 'pdf'])
  format?: 'csv' | 'pdf';

  @ApiPropertyOptional({
    example: 'SERIALIZED',
    description:
      'Inventory report only. QUANTITY | SERIALIZED. Comma-separated allowed.',
  })
  @IsOptional()
  @IsString()
  trackingType?: string;

  @ApiPropertyOptional({
    example: 'true',
    description: 'Inventory report only. Filter to low-stock rows.',
  })
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw new BadRequestException('lowStock must be true or false');
  })
  @IsBoolean()
  lowStock?: boolean;
}
