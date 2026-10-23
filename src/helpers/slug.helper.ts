export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

export function toModelKey(brandName: string, modelLabel: string): string {
  const brand = slugify(brandName) || 'brand';
  const model = slugify(modelLabel) || 'model';
  return `${brand}--${model}`;
}

export function parseModelKey(
  modelKey: string,
): { brandSlug: string; modelSlug: string } | null {
  const trimmed = decodeURIComponent(modelKey.trim());
  const sep = trimmed.indexOf('--');
  if (sep <= 0 || sep >= trimmed.length - 2) return null;
  const brandSlug = trimmed.slice(0, sep);
  const modelSlug = trimmed.slice(sep + 2);
  if (!brandSlug || !modelSlug) return null;
  return { brandSlug, modelSlug };
}
