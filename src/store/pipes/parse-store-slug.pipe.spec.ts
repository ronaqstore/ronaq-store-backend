import { BadRequestException } from '@nestjs/common';
import { ParseStoreSlugPipe } from './parse-store-slug.pipe.js';

describe('ParseStoreSlugPipe', () => {
  const pipe = new ParseStoreSlugPipe();

  it('accepts valid kebab slugs', () => {
    expect(pipe.transform('my-shop')).toBe('my-shop');
    expect(pipe.transform('  Timergara-Mobiles  ')).toBe('timergara-mobiles');
  });

  it('rejects path traversal and script-like values', () => {
    expect(() => pipe.transform('../etc/passwd')).toThrow(BadRequestException);
    expect(() => pipe.transform('<script>')).toThrow(BadRequestException);
    expect(() => pipe.transform('a/b')).toThrow(BadRequestException);
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });

  it('strips null bytes then validates', () => {
    expect(() => pipe.transform('bad\u0000slug!')).toThrow(BadRequestException);
    expect(pipe.transform('good\u0000-slug')).toBe('good-slug');
  });
});
