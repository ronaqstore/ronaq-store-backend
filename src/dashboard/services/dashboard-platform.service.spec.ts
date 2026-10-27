import {
  assertFunnelMonotonicFromCounts,
  buildGrowthSeriesWithCumulative,
  renewalsEligible,
  sumGrowthNewShops,
} from '../helpers/dashboard-platform.helper.js';

describe('DashboardPlatformService helpers', () => {
  describe('onboarding funnel monotonic', () => {
    it('accepts non-increasing stage counts', () => {
      expect(assertFunnelMonotonicFromCounts([100, 80, 70, 50, 40, 25])).toBe(
        true,
      );
    });

    it('rejects when a later stage exceeds an earlier one', () => {
      expect(assertFunnelMonotonicFromCounts([100, 120])).toBe(false);
    });
  });

  describe('shop growth totals', () => {
    it('sums new shops across months and matches cumulative delta', () => {
      const counts = new Map([
        ['2026-08', 10],
        ['2026-09', 15],
        ['2026-10', 5],
      ]);
      const series = buildGrowthSeriesWithCumulative(
        ['2026-08', '2026-09', '2026-10'],
        counts,
      );
      expect(sumGrowthNewShops(series)).toBe(30);
      expect(series[2]?.cumulativeShops).toBe(30);
    });

    it('reconciles baseline plus window sum with total shop count', () => {
      const totalShops = 130;
      const inWindow = 30;
      const baseline = totalShops - inWindow;
      const counts = new Map([
        ['2026-08', 10],
        ['2026-09', 15],
        ['2026-10', 5],
      ]);
      const series = buildGrowthSeriesWithCumulative(
        ['2026-08', '2026-09', '2026-10'],
        counts,
      );
      const lastCumulative = baseline + (series[2]?.cumulativeShops ?? 0);
      expect(lastCumulative).toBe(totalShops);
    });
  });

  describe('renewals eligibility filter', () => {
    const now = new Date('2026-10-27T12:00:00.000Z');

    it('includes ACTIVE shops with a future subscription end', () => {
      expect(
        renewalsEligible('ACTIVE', new Date('2026-11-01T00:00:00.000Z'), now),
      ).toBe(true);
    });

    it('excludes expired or suspended shops', () => {
      expect(
        renewalsEligible('ACTIVE', new Date('2026-10-01T00:00:00.000Z'), now),
      ).toBe(false);
      expect(
        renewalsEligible(
          'SUSPENDED',
          new Date('2026-12-01T00:00:00.000Z'),
          now,
        ),
      ).toBe(false);
    });
  });
});
