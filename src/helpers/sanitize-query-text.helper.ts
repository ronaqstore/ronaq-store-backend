const ARABIC_YEH = /\u064A/g;
const ARABIC_KAF = /\u0643/g;
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

function normalizeArabicScriptVariants(value: string): string {
  return value
    .replace(ARABIC_YEH, '\u06CC')
    .replace(ARABIC_KAF, '\u06A9')
    .replace(ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x0660),
    )
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (digit) =>
      String(digit.charCodeAt(0) - 0x06f0),
    )
    .replace(ZERO_WIDTH, '');
}

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
  cleaned = normalizeArabicScriptVariants(cleaned).replace(/\s+/g, ' ').trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}
