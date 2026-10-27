import {
  businessDayRange,
  businessToday,
  shiftDays,
} from '../../helpers/date.helper.js';

export type DashboardGranularity = 'day' | 'week' | 'month';

export interface DashboardResolvedRange {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  granularity: DashboardGranularity;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.max(0, Math.round((t2 - t1) / 86400000)) + 1;
}

export function resolveGranularity(days: number): DashboardGranularity {
  if (days <= 31) return 'day';
  if (days <= 183) return 'week';
  return 'month';
}

export function resolvePreviousPeriod(
  from: string,
  to: string,
): { prevFrom: string; prevTo: string } {
  const days = daysBetween(from, to);
  const prevTo = shiftDays(from, -1);
  const prevFrom = shiftDays(prevTo, -(days - 1));
  return { prevFrom, prevTo };
}

export function resolveDashboardRange(
  period?: string,
  fromParam?: string,
  toParam?: string,
): DashboardResolvedRange {
  const today = businessToday();
  let from = fromParam ?? today;
  let to = toParam ?? today;

  if (period === 'today') {
    from = today;
    to = today;
  } else if (period === 'yesterday') {
    from = shiftDays(today, -1);
    to = from;
  } else if (period === '7d' || period === 'last_7_days') {
    from = shiftDays(today, -6);
    to = today;
  } else if (period === '30d' || period === 'last_30_days') {
    from = shiftDays(today, -29);
    to = today;
  } else if (period === 'this_month') {
    const [y, m] = today.split('-').map(Number);
    from = `${y}-${String(m).padStart(2, '0')}-01`;
    to = today;
  } else if (period === 'last_month') {
    const [y, m] = today.split('-').map(Number);
    const lastMonthDate = new Date(Date.UTC(y, m - 2, 1));
    const ly = lastMonthDate.getUTCFullYear();
    const lm = lastMonthDate.getUTCMonth() + 1;
    const daysInLastMonth = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
    from = `${ly}-${String(lm).padStart(2, '0')}-01`;
    to = `${ly}-${String(lm).padStart(2, '0')}-${String(daysInLastMonth).padStart(2, '0')}`;
  } else if (period === 'custom' || (fromParam && toParam)) {
    from = fromParam ?? today;
    to = toParam ?? today;
  }

  if (from > to) {
    const temp = from;
    from = to;
    to = temp;
  }

  const days = daysBetween(from, to);
  const granularity = resolveGranularity(days);
  const { prevFrom, prevTo } = resolvePreviousPeriod(from, to);

  const { start } = businessDayRange(from);
  const { end } = businessDayRange(to);
  const { start: prevStart } = businessDayRange(prevFrom);
  const { end: prevEnd } = businessDayRange(prevTo);

  return {
    from,
    to,
    prevFrom,
    prevTo,
    granularity,
    start,
    end,
    prevStart,
    prevEnd,
  };
}

export function buildBuckets(
  from: string,
  to: string,
  granularity: DashboardGranularity,
): string[] {
  const buckets: string[] = [];
  let current = from;

  if (granularity === 'day') {
    while (current <= to) {
      buckets.push(current);
      current = shiftDays(current, 1);
    }
    return buckets;
  }

  if (granularity === 'week') {
    while (current <= to) {
      buckets.push(current);
      current = shiftDays(current, 7);
    }
    return buckets;
  }

  const [endY, endM] = to.split('-').map(Number);
  const endMonthKey = `${endY}-${String(endM).padStart(2, '0')}-01`;
  const [startY, startM] = from.split('-').map(Number);
  let y = startY;
  let m = startM;
  while (true) {
    const key = `${y}-${String(m).padStart(2, '0')}-01`;
    buckets.push(key);
    if (key >= endMonthKey) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return buckets;
}
