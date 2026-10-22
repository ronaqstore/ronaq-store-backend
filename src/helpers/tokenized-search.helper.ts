export function splitSearchTokens(search: string | null | undefined): string[] {
  if (!search) return [];
  return search
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function buildTokenizedSearchAnd<TClause>(
  search: string | null | undefined,
  branchesForToken: (token: string) => object[],
): TClause[] {
  return splitSearchTokens(search).map((token) => ({
    OR: branchesForToken(token),
  })) as TClause[];
}

export function stripDocSearchPrefix(token: string): string {
  const stripped = token
    .replace(/^(sale|bill|purchase)\s*#?/i, '')
    .replace(/^#/, '')
    .trim();
  return stripped || token;
}
