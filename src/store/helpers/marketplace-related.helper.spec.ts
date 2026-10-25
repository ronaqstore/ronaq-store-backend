import {
  buildRelatedSearchTokens,
  isDeviceProduct,
  scoreRelatedAccessory,
} from './marketplace-related.helper.js';

describe('marketplace-related.helper', () => {
  const iphone = {
    id: 'p1',
    name: 'iPhone 7 32GB',
    model: 'iPhone 7',
    trackingType: 'SERIALIZED',
    brandName: 'Apple',
    categoryName: 'Mobile Phones',
  };

  it('detects phones as device products', () => {
    expect(isDeviceProduct(iphone)).toBe(true);
    expect(
      isDeviceProduct({
        ...iphone,
        trackingType: 'QUANTITY',
        categoryName: 'Cases & Covers',
      }),
    ).toBe(false);
  });

  it('builds searchable brand and model tokens', () => {
    const tokens = buildRelatedSearchTokens(iphone);
    expect(tokens).toEqual(
      expect.arrayContaining(['iphone 7', 'apple', 'iphone']),
    );
  });

  it('scores covers and chargers matching the phone higher than unrelated', () => {
    const tokens = buildRelatedSearchTokens(iphone);
    const cover = scoreRelatedAccessory(
      {
        id: 'c1',
        name: 'Apple iPhone 7 Soft Cover',
        model: null,
        trackingType: 'QUANTITY',
        categoryName: 'Cases & Covers',
        brandName: 'Apple',
      },
      iphone,
      tokens,
    );
    const random = scoreRelatedAccessory(
      {
        id: 'c2',
        name: 'Generic USB Cable',
        model: null,
        trackingType: 'QUANTITY',
        categoryName: 'Chargers & Cables',
        brandName: 'Ronin',
      },
      iphone,
      tokens,
    );
    expect(cover).toBeGreaterThan(random);
    expect(cover).toBeGreaterThan(0);
  });
});
