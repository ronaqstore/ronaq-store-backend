import { ApiPropertyOptional } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Access lens for the platform shop list.
 *
 * ACTIVE   — shop.status ACTIVE and subscriptionEndsAt is still in the future
 * EXPIRED  — shop.status ACTIVE but subscriptionEndsAt has passed
 * SUSPENDED — shop.status SUSPENDED (admin paused; date may or may not have passed)
 */
export type PlatformShopAccessStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

const ACCESS_STATUSES: PlatformShopAccessStatus[] = [
  'ACTIVE',
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

export class ListShopsQueryDto {
  @ApiPropertyOptional({ example: 1, description: '1-based page number.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Rows per page, max 100.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({
    example: 'khalid',
    description:
      'Case-insensitive contains search across shop name, shop phone, address, owner name and owner phone.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE,EXPIRED',
    description:
      'Filter by derived access state. One value or a comma-separated list: ACTIVE | EXPIRED | SUSPENDED. Omit for all.',
  })
  @IsOptional()
  @Transform(({ value }) => parseAccessStatuses(value))
  accessStatus?: PlatformShopAccessStatus[];

  @ApiPropertyOptional({
    example: 'createdAt',
    description: 'Field to sort by. name | createdAt | subscriptionEndsAt.',
  })
  @IsOptional()
  @IsIn(['name', 'createdAt', 'subscriptionEndsAt'])
  sortBy?: 'name' | 'createdAt' | 'subscriptionEndsAt' = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', description: 'asc or desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
