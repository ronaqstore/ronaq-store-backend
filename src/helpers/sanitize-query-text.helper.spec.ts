import { sanitizeQueryText } from './sanitize-query-text.helper.js';

describe('sanitizeQueryText', () => {
  it('strips null bytes and control characters', () => {
    expect(sanitizeQueryText('iphone\u0000 12', 100)).toBe('iphone 12');
    expect(sanitizeQueryText('a\u0007b\u001Fc', 100)).toBe('abc');
  });

  it('trims, caps length, and drops empties', () => {
    expect(sanitizeQueryText('  hello  ', 100)).toBe('hello');
    expect(sanitizeQueryText('abcdefghij', 5)).toBe('abcde');
    expect(sanitizeQueryText('   ', 100)).toBeUndefined();
    expect(sanitizeQueryText(null, 100)).toBeUndefined();
  });
});
