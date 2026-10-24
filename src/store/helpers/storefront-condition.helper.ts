import type { ResponseStoreProductDto } from '../dto/response-storefront.dto.js';

export function applyUnitConditionSummary(
  product: ResponseStoreProductDto,
): void {
  const units = product.units ?? [];
  if (units.length === 0) {
    product.condition = null;
    return;
  }
  const hasNew = units.some((unit) => unit.condition === 'NEW');
  const hasUsed = units.some((unit) => unit.condition === 'USED');
  if (hasNew && !hasUsed) {
    product.condition = 'NEW';
    return;
  }
  if (hasUsed && !hasNew) {
    product.condition = 'USED';
    return;
  }
  product.condition = null;
}
