import { ApiPropertyOptional } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { PaginatedListQueryFilterDto } from '../../common-dto/query/paginated-list-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export type PlatformShopAccessStatus =
  'ACTIVE' | 'TRIALING' | 'EXPIRED' | 'SUSPENDED';

const ACCESS_STATUSES: PlatformShopAccessStatus[] = [
  'ACTIVE',
  'TRIALING',
  'EXPIRED',
  'SUSPENDED',
];

export function parseAccessStatuses(
  value: unknown,
): PlatformShopAccessStatus[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value.join(',') : String(value);
  const parts = raw
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  const invalid = parts.filter(
    (part) => !ACCESS_STATUSES.includes(part as PlatformShopAccessStatus),
  );
  if (invalid.length > 0) {
    throw new BadRequestException(
      `accessStatus must be one or more of ACTIVE, EXPIRED, SUSPENDED (got: ${invalid.join(', ')})`,
    );
  }

  return [...new Set(parts)] as PlatformShopAccessStatus[];
}

export class ListShopsQueryDto extends PaginatedListQueryFilterDto {
  @OptionalSearchQueryProperty(
    'khalid',
    'Case-insensitive contains search across shop name, shop phone, address, owner name and owner phone.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE,EXPIRED',
    description:
      'Filter by derived access state. One value or a comma-separated list: ACTIVE | EXPIRED | SUSPENDED. Omit for all.',
  })
  @IsOptional()
  @Transform(({ value }) => parseAccessStatuses(value))
  accessStatus?: PlatformShopAccessStatus[];

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on subscriptionEndsAt, YYYY-MM-DD.',
  )
  subscriptionFrom?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on subscriptionEndsAt, YYYY-MM-DD.',
  )
  subscriptionTo?: string;

  @InclusiveDateFromQueryProperty(
    'Inclusive lower bound on createdAt, YYYY-MM-DD.',
  )
  createdFrom?: string;

  @InclusiveDateToQueryProperty(
    'Inclusive upper bound on createdAt, YYYY-MM-DD.',
  )
  createdTo?: string;

  @ApiPropertyOptional({
    example: 'createdAt',
    description: 'Field to sort by. name | createdAt | subscriptionEndsAt.',
  })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'subscriptionEndsAt'])
  sortBy?: 'name' | 'createdAt' | 'subscriptionEndsAt' = 'createdAt';
}
