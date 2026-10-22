import { phoneSearchVariants } from './phone-search.helper.js';

describe('phoneSearchVariants', () => {
  it('includes local and E.164 forms for a full PK mobile', () => {
    const variants = phoneSearchVariants('03020000120');
    expect(variants).toEqual(
      expect.arrayContaining(['03020000120', '923020000120']),
    );
  });

  it('maps partial local prefix to E.164 prefix', () => {
    const variants = phoneSearchVariants('0302');
    expect(variants).toEqual(expect.arrayContaining(['0302', '92302']));
  });

  it('strips separators before matching', () => {
    const variants = phoneSearchVariants('0302-0000120');
    expect(variants).toEqual(
      expect.arrayContaining(['03020000120', '923020000120']),
    );
  });

  it('returns empty for blank input', () => {
    expect(phoneSearchVariants('')).toEqual([]);
    expect(phoneSearchVariants('   ')).toEqual([]);
  });
});
