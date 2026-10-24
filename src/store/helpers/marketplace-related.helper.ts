export const MARKETPLACE_ACCESSORY_CATEGORY_NAMES = [
  'Wireless Earbuds',
  'Earphones',
  'Power Banks',
  'Chargers & Cables',
  'Cases & Covers',
  'Screen Guards',
  'Speakers',
  'Storage & Memory Cards',
  'Accessories',
] as const;

export const MARKETPLACE_DEVICE_CATEGORY_NAMES = [
  'Mobile Phones',
  'Tablets & iPads',
  'Smart Watches',
] as const;

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'new',
  'used',
  'gb',
  'tb',
  'ram',
  'rom',
]);

export type RelatedSourceProduct = {
  id: string;
  name: string;
  model: string | null;
  trackingType: string;
  brandName: string;
  categoryName: string;
};

export type RelatedCandidateProduct = {
  id: string;
  name: string;
  model: string | null;
  trackingType: string;
  categoryName: string;
  brandName: string;
};

export function isDeviceProduct(source: RelatedSourceProduct): boolean {
  if (source.trackingType === 'SERIALIZED') return true;
  return MARKETPLACE_DEVICE_CATEGORY_NAMES.some(
    (name) => name.toLowerCase() === source.categoryName.toLowerCase(),
  );
}

export function buildRelatedSearchTokens(
  source: RelatedSourceProduct,
): string[] {
  const raw = `${source.brandName} ${source.model ?? ''} ${source.name}`;
  const parts = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s+]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !STOP_WORDS.has(part));

  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part);
  }

  const brand = source.brandName.trim().toLowerCase();
  if (brand && !unique.includes(brand)) unique.unshift(brand);

  const model = (source.model ?? '').trim().toLowerCase();
  if (model && model.length >= 2 && !unique.includes(model)) {
    unique.unshift(model);
  }

  return unique.slice(0, 12);
}

export function scoreRelatedAccessory(
  candidate: RelatedCandidateProduct,
  source: RelatedSourceProduct,
  tokens: string[],
): number {
  const haystack =
    `${candidate.name} ${candidate.model ?? ''} ${candidate.brandName}`.toLowerCase();
  const category = candidate.categoryName.toLowerCase();
  let score = 0;

  const brand = source.brandName.trim().toLowerCase();
  if (brand && haystack.includes(brand)) score += 50;

  const model = (source.model ?? '').trim().toLowerCase();
  if (model.length >= 2 && haystack.includes(model)) score += 80;

  for (const token of tokens) {
    if (token.length < 2) continue;
    if (haystack.includes(token)) score += 12;
  }

  if (
    category.includes('case') ||
    category.includes('cover') ||
    category.includes('screen')
  ) {
    score += 35;
  } else if (
    category.includes('charger') ||
    category.includes('cable') ||
    category.includes('power')
  ) {
    score += 30;
  } else if (
    category.includes('ear') ||
    category.includes('bud') ||
    category.includes('speaker') ||
    category.includes('storage') ||
    category.includes('accessori')
  ) {
    score += 20;
  }

  if (candidate.trackingType === 'QUANTITY') score += 10;

  if (candidate.id === source.id) return -1;
  return score;
}
