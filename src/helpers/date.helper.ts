export const BUSINESS_TIME_ZONE = 'Asia/Karachi';
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

const businessDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function businessToday(now: Date = new Date()): string {
  return businessDayFormatter.format(now);
}

export function resolveTransactionDate(
  inputDate?: string | Date,
  now: Date = new Date(),
): Date {
  if (!inputDate) {
    return now;
  }
  if (inputDate instanceof Date) {
    return inputDate;
  }
  if (inputDate === businessToday(now)) {
    return now;
  }
  return new Date(inputDate);
}

export function businessDayRange(date: string): { start: Date; end: Date } {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - KARACHI_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function shiftDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86400000);
  return shifted.toISOString().slice(0, 10);
}

export type ReportPeriod = 'today' | 'week' | 'month' | 'custom';

export interface PeriodRange {
  start: Date;

  end: Date;

  from: string;

  to: string;
}

export function periodRange(
  period: ReportPeriod = 'today',
  from?: string,
  to?: string,
): PeriodRange {
  if (from || to) {
    const anchor = from ?? to;
    if (anchor === undefined) {
      throw new Error('periodRange: from or to required');
    }
    const resolvedFrom = from ?? anchor;
    const resolvedTo = to ?? anchor;
    return {
      start: businessDayRange(resolvedFrom).start,
      end: businessDayRange(resolvedTo).end,
      from: resolvedFrom,
      to: resolvedTo,
    };
  }

  const today = businessToday();
  if (period === 'week') {
    const [year, month, day] = today.split('-').map(Number);

    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const monday = shiftDays(today, -((dow + 6) % 7));
    return {
      start: businessDayRange(monday).start,
      end: businessDayRange(shiftDays(monday, 7)).end,
      from: monday,
      to: shiftDays(monday, 6),
    };
  }

  if (period === 'month') {
    const [year, month] = today.split('-').map(Number);
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      start: businessDayRange(first).start,
      end: businessDayRange(shiftDays(first, daysInMonth)).end,
      from: first,
      to: shiftDays(first, daysInMonth - 1),
    };
  }

  return {
    start: businessDayRange(today).start,
    end: businessDayRange(today).end,
    from: today,
    to: today,
  };
}

export function dateColumnRange(
  from: string,
  to: string,
): {
  gte: Date;
  lt: Date;
} {
  return {
    gte: new Date(`${from}T00:00:00.000Z`),
    lt: new Date(`${shiftDays(to, 1)}T00:00:00.000Z`),
  };
}
