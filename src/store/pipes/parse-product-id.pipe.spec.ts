import { BadRequestException } from '@nestjs/common';
import { ParseProductIdPipe } from './parse-product-id.pipe.js';

describe('ParseProductIdPipe', () => {
  const pipe = new ParseProductIdPipe();

  it('accepts uuid v7-style ids', () => {
    expect(pipe.transform('01924f0a-0000-7000-8000-000000000010')).toBe(
      '01924f0a-0000-7000-8000-000000000010',
    );
  });

  it('rejects non-uuid and hostile input', () => {
    expect(() => pipe.transform('../secret')).toThrow(BadRequestException);
    expect(() => pipe.transform('not-a-uuid')).toThrow(BadRequestException);
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });
});
