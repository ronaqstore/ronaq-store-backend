export function normalizeCnicOrNull(
  value: unknown,
): string | null | undefined | unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 13) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  }
  return trimmed;
}

export function isValidPkCnic(input: string | null | undefined): boolean {
  if (!input) return false;
  const digits = input.replace(/\D/g, '');
  if (!/^\d{13}$/.test(digits)) return false;
  if (/^0{13}$/.test(digits)) return false;
  const areaFirst = Number(digits[0]);
  if (areaFirst < 1 || areaFirst > 7) return false;
  return true;
}
