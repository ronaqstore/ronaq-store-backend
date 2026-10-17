import { ApiProperty } from '@nestjs/swagger';

/**
 * KPI strip for the platform dashboard.
 *
 * No MRR / plan revenue — the backend has no billing ledger yet. Counts are
 * derived from Shop.status + subscriptionEndsAt only.
 */
export class PlatformOverviewResponseDto {
  @ApiProperty({ example: 42 })
  totalShops: number;

  @ApiProperty({
    example: 30,
    description: 'ACTIVE status and subscriptionEndsAt still in the future.',
  })
  activeShops: number;

  @ApiProperty({
    example: 5,
    description: 'ACTIVE status but subscriptionEndsAt has passed.',
  })
  expiredShops: number;

  @ApiProperty({
    example: 7,
    description: 'Shop.status = SUSPENDED (admin pause).',
  })
  suspendedShops: number;
}
