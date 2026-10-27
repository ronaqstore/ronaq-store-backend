import {
  agingBucketForDays,
  computeOverdueDays,
  sumAgingBucketAmounts,
} from './dashboard-aging.helper.js';

describe('dashboard aging helpers', () => {
  it('uses dueDate overdue days when dueDate is set and past', () => {
    expect(computeOverdueDays('2026-10-27', '2026-09-01', '2026-10-20')).toBe(
      7,
    );
  });

  it('returns 0 when dueDate is today or in the future', () => {
    expect(computeOverdueDays('2026-10-27', '2026-09-01', '2026-10-27')).toBe(
      0,
    );
    expect(computeOverdueDays('2026-10-27', '2026-09-01', '2026-11-01')).toBe(
      0,
    );
  });

  it('falls back to sale age when dueDate is missing', () => {
    expect(computeOverdueDays('2026-10-27', '2026-10-20', null)).toBe(7);
    expect(computeOverdueDays('2026-10-27', '2026-10-27', undefined)).toBe(0);
  });

  it('maps days into aging buckets', () => {
    expect(agingBucketForDays(0)).toBe('0-7');
    expect(agingBucketForDays(7)).toBe('0-7');
    expect(agingBucketForDays(8)).toBe('8-30');
    expect(agingBucketForDays(30)).toBe('8-30');
    expect(agingBucketForDays(31)).toBe('31-60');
    expect(agingBucketForDays(60)).toBe('31-60');
    expect(agingBucketForDays(61)).toBe('60+');
    expect(agingBucketForDays(120)).toBe('60+');
  });

  it('sums aging bucket amounts to equal total udhar', () => {
    const buckets = [
      { amount: 100 },
      { amount: 200 },
      { amount: 50 },
      { amount: 25 },
    ];
    expect(sumAgingBucketAmounts(buckets)).toBe(375);
  });
});
