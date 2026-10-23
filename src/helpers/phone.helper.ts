const LOCAL_PREFIX = /^03\d{9}$/;
const E164_PREFIX = /^923\d{9}$/;

export const normalizePhone = (
  input: string | null | undefined,
): string | null => {
  if (!input) return null;

  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');

  if (E164_PREFIX.test(digits)) return digits;
  if (LOCAL_PREFIX.test(digits)) return `92${digits.slice(1)}`;

  return null;
};

export const toLocalPkPhone = (
  input: string | null | undefined,
): string | null => {
  const canonical = normalizePhone(input);
  if (!canonical) return null;
  return `0${canonical.slice(2)}`;
};

export const normalizePhoneOrRaw = (input: string): string =>
  normalizePhone(input) ?? input.replace(/[\s\-().]/g, '').replace(/^\+/, '');
