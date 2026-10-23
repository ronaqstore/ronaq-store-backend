import {
  buildTokenizedSearchAnd,
  splitSearchTokens,
  stripDocSearchPrefix,
} from './tokenized-search.helper.js';

describe('tokenized-search.helper', () => {
  it('splits on whitespace and drops empties', () => {
    expect(splitSearchTokens('  clear   old  ')).toEqual(['clear', 'old']);
    expect(splitSearchTokens('')).toEqual([]);
    expect(splitSearchTokens(null)).toEqual([]);
  });

  it('requires every token to match (AND of ORs)', () => {
    const clauses = buildTokenizedSearchAnd<{
      OR: Array<{ notes: { contains: string } }>;
    }>('clear old', (token) => [{ notes: { contains: token } }]);
    expect(clauses).toEqual([
      { OR: [{ notes: { contains: 'clear' } }] },
      { OR: [{ notes: { contains: 'old' } }] },
    ]);
  });

  it('strips bill/sale prefixes', () => {
    expect(stripDocSearchPrefix('Bill #P-0047')).toBe('P-0047');
    expect(stripDocSearchPrefix('#S-0047')).toBe('S-0047');
    expect(stripDocSearchPrefix('warehouse')).toBe('warehouse');
  });
});
