import { buildMarketplaceModelSearchSql } from './marketplace-model-search.helper.js';

describe('buildMarketplaceModelSearchSql', () => {
  it('returns null for empty search', () => {
    expect(buildMarketplaceModelSearchSql('  ', null, 8)).toBeNull();
  });

  it('builds parameterized sql for query and city tokens', () => {
    const sql = buildMarketplaceModelSearchSql('iphone 7', ['Timergara'], 8);
    expect(sql).not.toBeNull();
    const text = sql?.strings.join(' ') ?? '';
    expect(text).toContain('ILIKE');
    expect(text).toContain('GROUP BY');
    expect(text).toContain('LIMIT');
  });
});
