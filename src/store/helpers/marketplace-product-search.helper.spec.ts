import {
  buildMarketplaceProductSearchSql,
  canUseLeanProductSearch,
} from './marketplace-product-search.helper.js';

describe('marketplace product search sql', () => {
  it('returns null for empty query', () => {
    expect(
      buildMarketplaceProductSearchSql({
        q: '   ',
        cityTokens: null,
        skip: 0,
        take: 20,
      }),
    ).toBeNull();
  });

  it('builds parameterized listing sql with city and price', () => {
    const sql = buildMarketplaceProductSearchSql({
      q: 'iphone 12',
      cityTokens: ['Timergara'],
      minPrice: 1000,
      sort: 'newest',
      skip: 0,
      take: 21,
    });
    expect(sql).not.toBeNull();
    const text = sql?.strings.join(' ') ?? '';
    expect(text).toContain('ILIKE');
    expect(text).toContain('LIMIT');
    expect(text).toContain('OFFSET');
  });

  it('uses lean path only for simple text search', () => {
    expect(canUseLeanProductSearch({ q: 'iphone 12' })).toBe(true);
    expect(canUseLeanProductSearch({ q: 'iphone 12', condition: 'NEW' })).toBe(
      false,
    );
    expect(canUseLeanProductSearch({ q: 'a' })).toBe(false);
  });
});
