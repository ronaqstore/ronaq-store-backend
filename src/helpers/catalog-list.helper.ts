export function buildShopNamedEntityWhere(
  shopId: string,
  search?: string,
  isActive?: boolean | null,
): {
  shopId: string;
  name?: { contains: string; mode: 'insensitive' };
  isActive?: boolean;
} {
  const where: {
    shopId: string;
    name?: { contains: string; mode: 'insensitive' };
    isActive?: boolean;
  } = { shopId };
  if (search) {
    where.name = { contains: search.trim(), mode: 'insensitive' };
  }
  if (isActive !== undefined && isActive !== null) {
    where.isActive = isActive;
  }
  return where;
}
