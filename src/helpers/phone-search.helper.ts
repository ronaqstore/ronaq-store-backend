import { normalizePhone } from './phone.helper.js';

export function phoneSearchVariants(token: string): string[] {
  const trimmed = token.trim();
  if (!trimmed) return [];

  const digits = trimmed.replace(/\D/g, '');
  const variants = new Set<string>([trimmed]);

  if (digits) {
    variants.add(digits);
  }

  const canonical = normalizePhone(trimmed) ?? normalizePhone(digits);
  if (canonical) {
    variants.add(canonical);
    variants.add(`0${canonical.slice(2)}`);
  }

  if (digits.startsWith('03') && digits.length >= 3) {
    variants.add(`92${digits.slice(1)}`);
  }
  if (digits.startsWith('923') && digits.length >= 3) {
    variants.add(`0${digits.slice(2)}`);
  }
  if (
    digits.startsWith('3') &&
    !digits.startsWith('92') &&
    digits.length >= 9
  ) {
    variants.add(`92${digits}`);
    variants.add(`0${digits}`);
  }

  return [...variants];
}
