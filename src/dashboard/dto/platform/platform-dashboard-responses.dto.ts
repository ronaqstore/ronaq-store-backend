import { ApiProperty } from '@nestjs/swagger';

export class PlatformKpisDto {
  @ApiProperty() totalShops: number;
  @ApiProperty() activeShops: number;
  @ApiProperty() expiredShops: number;
  @ApiProperty() suspendedShops: number;
  @ApiProperty() newThisMonth: number;
  @ApiProperty() expiringIn7Days: number;
  @ApiProperty() shopsWithSaleLast7Days: number;
  @ApiProperty() onlineStoreEnabledCount: number;
  @ApiProperty() onlineStoreEnabledPercent: number;
}

export class ShopGrowthPointDto {
  @ApiProperty({ example: '2026-01' }) month: string;
  @ApiProperty() newShops: number;
  @ApiProperty() cumulative: number;
}

export class ShopGrowthResponseDto {
  @ApiProperty({ type: [ShopGrowthPointDto] }) series: ShopGrowthPointDto[];
  @ApiProperty() totalShops: number;
}

export class RenewalWeekBucketDto {
  @ApiProperty({ example: '2026-10-27' }) weekStart: string;
  @ApiProperty() expiringCount: number;
}

export class ExpiringShopDto {
  @ApiProperty({ description: 'Shop id' })
  id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) ownerPhone: string | null;
  @ApiProperty({ nullable: true }) city: string | null;
  @ApiProperty() endsAt: string;
}

export class RenewalsResponseDto {
  @ApiProperty({ type: [RenewalWeekBucketDto] }) series: RenewalWeekBucketDto[];
  @ApiProperty({ type: [ExpiringShopDto] }) nextExpiring: ExpiringShopDto[];
}

export class FunnelStageDto {
  @ApiProperty() key: string;
  @ApiProperty() label: string;
  @ApiProperty() count: number;
  @ApiProperty({ description: 'Drop-off % from previous stage' })
  dropOffPct: number;
}

export class OnboardingFunnelResponseDto {
  @ApiProperty({ type: [FunnelStageDto] }) stages: FunnelStageDto[];
}

export class CityBucketDto {
  @ApiProperty() city: string;
  @ApiProperty() shopCount: number;
}

export class ShopsByCityResponseDto {
  @ApiProperty({ type: [CityBucketDto] }) buckets: CityBucketDto[];
}

export class ActivityPointDto {
  @ApiProperty({ example: '2026-10-01' }) date: string;
  @ApiProperty() salesCount: number;
  @ApiProperty() activeShops: number;
}

export class ActivityResponseDto {
  @ApiProperty({ type: [ActivityPointDto] }) series: ActivityPointDto[];
}

export class AtRiskShopDto {
  @ApiProperty({ description: 'Shop id' })
  id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) city: string | null;
  @ApiProperty({ nullable: true }) lastSaleAt: string | null;
  @ApiProperty() subscriptionEndsAt: string;
  @ApiProperty({ nullable: true }) ownerPhone: string | null;
}

export class AtRiskResponseDto {
  @ApiProperty({ type: [AtRiskShopDto] }) items: AtRiskShopDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
}
