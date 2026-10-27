import { businessToday } from './date.helper.js';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const needsQuoting = (value: string): boolean => /[",\r\n]/.test(value);

const escapeField = (value: string): string =>
  needsQuoting(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => c.header).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeField(String(c.value(row) ?? ''))).join(','),
  );
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
}

export function formatRupees(paisa: bigint | number): string {
  const value = Number(paisa) / 100;
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPaisaToRupees(paisa: bigint | number): string {
  const value = Math.round(Number(paisa) / 100);
  return value.toLocaleString('en-PK');
}

export function formatBusinessDate(value: Date | null | undefined): string {
  if (!value) return '—';
  return businessToday(value);
}
