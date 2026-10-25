import { BadRequestException } from '@nestjs/common';
import { ParseModelKeyPipe } from './parse-model-key.pipe.js';

describe('ParseModelKeyPipe', () => {
  const pipe = new ParseModelKeyPipe();

  it('accepts brand--model keys', () => {
    expect(pipe.transform('samsung--galaxy-a15')).toBe('samsung--galaxy-a15');
  });

  it('rejects missing separator and hostile input', () => {
    expect(() => pipe.transform('samsung')).toThrow(BadRequestException);
    expect(() => pipe.transform('--only-model')).toThrow(BadRequestException);
    expect(() => pipe.transform('../x--y')).toThrow(BadRequestException);
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });
});
