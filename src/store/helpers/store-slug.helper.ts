export const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'store',
  'stores',
  'static',
  'assets',
  'cdn',
  'mail',
  'support',
  'help',
  'dashboard',
  'login',
  'signup',
  'public',
  'status',
  'dukaan',
  'dukaanpro',
  'dukanpro',
]);

export function storeSlugBase(name: string, shopId: string): string {
  const slugified =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 34)
      .replace(/^-+|-+$/g, '') || '';
  const fallback = `shop-${shopId.replace(/-/g, '').slice(0, 6)}`;
  const base = slugified.length >= 3 ? slugified : fallback;
  return RESERVED_SLUGS.has(base) ? `${base}-shop` : base;
}

export async function nextFreeStoreSlug(
  base: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    if (!(await isTaken(candidate))) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }
}
