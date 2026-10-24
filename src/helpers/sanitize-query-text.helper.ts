export function sanitizeQueryText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  let cleaned = '';
  for (const char of value.normalize('NFKC')) {
    const code = char.codePointAt(0) ?? 0;
    if (
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    ) {
      continue;
    }
    cleaned += char;
  }
  const trimmed = cleaned.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}
