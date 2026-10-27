import { businessToday, shiftDays } from '../../helpers/date.helper.js';

export function monthKeysEndingAt(
  monthCount: number,
  anchor = businessToday(),
): string[] {
  const [y, m] = anchor.split('-').map(Number);
  const keys: string[] = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const ky = d.getUTCFullYear();
    const km = String(d.getUTCMonth() + 1).padStart(2, '0');
    keys.push(`${ky}-${km}`);
  }
  return keys;
}

export function daysBackStart(days: number): Date {
  const from = shiftDays(businessToday(), -(days - 1));
  const [year, month, day] = from.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 5 * 60 * 60 * 1000);
}
