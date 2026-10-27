export const PLATFORM_DASHBOARD_CACHE_TTL_SECONDS = 300;

export interface GrowthMonthRow {
  month: string;
  newShops: number;
  cumulativeShops: number;
}

export function assertFunnelMonotonicFromCounts(counts: number[]): boolean {
  for (let i = 1; i < counts.length; i += 1) {
    if (counts[i] > counts[i - 1]) {
      return false;
    }
  }
  return true;
}

export function buildGrowthSeriesWithCumulative(
  monthKeys: string[],
  countsByMonth: Map<string, number>,
): GrowthMonthRow[] {
  let cumulative = 0;
  return monthKeys.map((month) => {
    const newShops = countsByMonth.get(month) ?? 0;
    cumulative += newShops;
    return { month, newShops, cumulativeShops: cumulative };
  });
}

export function sumGrowthNewShops(series: GrowthMonthRow[]): number {
  return series.reduce((sum, row) => sum + row.newShops, 0);
}

export function renewalsEligible(
  status: string,
  subscriptionEndsAt: Date,
  now: Date,
): boolean {
  return status === 'ACTIVE' && subscriptionEndsAt.getTime() > now.getTime();
}
