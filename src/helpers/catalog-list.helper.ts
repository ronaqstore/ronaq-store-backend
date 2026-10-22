import { buildTokenizedSearchAnd } from './tokenized-search.helper.js';

type NamedContains = { contains: string; mode: 'insensitive' };

type ShopNamedEntityWhere = {
  shopId: string;
  isActive?: boolean;
  AND?: Array<{ OR: Array<{ name: NamedContains }> }>;
  name?: NamedContains;
};

export function buildShopNamedEntityWhere(
  shopId: string,
  search?: string,
  isActive?: boolean | null,
): ShopNamedEntityWhere {
  const where: ShopNamedEntityWhere = { shopId };

  type NameClause = { OR: Array<{ name: NamedContains }> };
  const searchAnd = buildTokenizedSearchAnd<NameClause>(search, (token) => [
    { name: { contains: token, mode: 'insensitive' as const } },
  ]);
  const firstToken = searchAnd[0];
  const firstNameBranch = firstToken?.OR[0];
  if (searchAnd.length === 1 && firstNameBranch) {
    where.name = firstNameBranch.name;
  } else if (searchAnd.length > 1) {
    where.AND = searchAnd;
  }

  if (isActive !== undefined && isActive !== null) {
    where.isActive = isActive;
  }
  return where;
}
