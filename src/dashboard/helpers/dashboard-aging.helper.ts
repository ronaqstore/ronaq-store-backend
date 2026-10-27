import { daysBetween } from './dashboard-date.helper.js';

export type AgingBucketKey = '0-7' | '8-30' | '31-60' | '60+';

export function computeOverdueDays(
  today: string,
  saleDateIso: string,
  dueDateIso: string | null | undefined,
): number {
  if (dueDateIso) {
    const dueStr = dueDateIso.slice(0, 10);
    if (dueStr < today) {
      return Math.max(0, daysBetween(dueStr, today) - 1);
    }
    return 0;
  }
  const saleDateStr = saleDateIso.slice(0, 10);
  return Math.max(0, daysBetween(saleDateStr, today) - 1);
}

export function agingBucketForDays(days: number): AgingBucketKey {
  if (days <= 7) return '0-7';
  if (days <= 30) return '8-30';
  if (days <= 60) return '31-60';
  return '60+';
}

export function sumAgingBucketAmounts(
  buckets: Array<{ amount: number }>,
): number {
  return buckets.reduce((sum, b) => sum + b.amount, 0);
}
