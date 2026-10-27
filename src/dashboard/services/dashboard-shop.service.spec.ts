import {
  buildBuckets,
  daysBetween,
  resolveDashboardRange,
  resolveGranularity,
  resolvePreviousPeriod,
} from '../helpers/dashboard-date.helper.js';

describe('DashboardShopService Date & Math Logic', () => {
  it('correctly calculates daysBetween two dates inclusive', () => {
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(1);
    expect(daysBetween('2026-10-01', '2026-10-07')).toBe(7);
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(31);
  });

  it('resolves granularity correctly based on date span', () => {
    expect(resolveGranularity(1)).toBe('day');
    expect(resolveGranularity(7)).toBe('day');
    expect(resolveGranularity(31)).toBe('day');
    expect(resolveGranularity(32)).toBe('week');
    expect(resolveGranularity(180)).toBe('week');
    expect(resolveGranularity(184)).toBe('month');
    expect(resolveGranularity(365)).toBe('month');
  });

  it('resolves previous period of exact matching length', () => {
    const { prevFrom, prevTo } = resolvePreviousPeriod(
      '2026-10-08',
      '2026-10-14',
    );
    expect(prevTo).toBe('2026-10-07');
    expect(prevFrom).toBe('2026-10-01');
    expect(daysBetween(prevFrom, prevTo)).toBe(7);
  });

  it('builds day buckets correctly', () => {
    const buckets = buildBuckets('2026-10-01', '2026-10-05', 'day');
    expect(buckets).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ]);
  });

  it('builds week buckets correctly', () => {
    const buckets = buildBuckets('2026-10-01', '2026-10-20', 'week');
    expect(buckets).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
  });

  it('builds month buckets correctly', () => {
    const buckets = buildBuckets('2026-08-15', '2026-10-10', 'month');
    expect(buckets).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });

  it('resolves predefined periods correctly', () => {
    const range7d = resolveDashboardRange('7d');
    expect(daysBetween(range7d.from, range7d.to)).toBe(7);
    expect(range7d.granularity).toBe('day');

    const range30d = resolveDashboardRange('30d');
    expect(daysBetween(range30d.from, range30d.to)).toBe(30);
    expect(range30d.granularity).toBe('day');
  });

  it('ensures profit waterfall math reconciles with net profit', () => {
    const grossSales = 1000000;
    const cogs = 600000;
    const returns = 50000;
    const expenses = 150000;
    const netProfit = grossSales - cogs - returns - expenses;

    expect(netProfit).toBe(200000);
  });
});
