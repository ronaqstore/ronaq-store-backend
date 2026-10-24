import { applyUnitConditionSummary } from './storefront-condition.helper.js';
import type { ResponseStoreProductDto } from '../dto/response-storefront.dto.js';

function productWithUnits(
  conditions: Array<'NEW' | 'USED'>,
): ResponseStoreProductDto {
  return {
    id: 'p1',
    name: 'Phone',
    brand: 'Apple',
    category: 'Mobile Phones',
    trackingType: 'SERIALIZED',
    price: 100,
    availability: 'IN_STOCK',
    stockCount: conditions.length,
    images: [],
    specs: { model: null, color: null, ram: null, storage: null },
    units: conditions.map((condition, index) => ({
      id: `u${index}`,
      imeiMasked: `****${index}`,
      condition,
      batteryHealth: null,
      price: 100,
      defectNotes: null,
    })),
  };
}

describe('applyUnitConditionSummary', () => {
  it('sets NEW when all units are new', () => {
    const product = productWithUnits(['NEW', 'NEW']);
    applyUnitConditionSummary(product);
    expect(product.condition).toBe('NEW');
  });

  it('sets USED when all units are used', () => {
    const product = productWithUnits(['USED']);
    applyUnitConditionSummary(product);
    expect(product.condition).toBe('USED');
  });

  it('clears condition when units are mixed or empty', () => {
    const mixed = productWithUnits(['NEW', 'USED']);
    applyUnitConditionSummary(mixed);
    expect(mixed.condition).toBeNull();

    const empty = productWithUnits([]);
    applyUnitConditionSummary(empty);
    expect(empty.condition).toBeNull();
  });
});
