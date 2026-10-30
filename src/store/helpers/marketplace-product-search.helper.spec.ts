import {
  buildMarketplaceProductSearchSql,
  canUseLeanProductSearch,
  type MarketplaceProductSearchRow,
} from './marketplace-product-search.helper.js';
import { toLeanMarketplaceProduct } from './marketplace-product.mapper.js';

describe('marketplace product search sql', () => {
  it('returns null for empty query', () => {
    expect(
      buildMarketplaceProductSearchSql({
        q: '   ',
        cityTokens: null,
        skip: 0,
        take: 20,
      }),
    ).toBeNull();
  });

  it('builds parameterized listing sql with city and price', () => {
    const sql = buildMarketplaceProductSearchSql({
      q: 'iphone 12',
      cityTokens: ['Timergara'],
      minPrice: 1000,
      sort: 'newest',
      skip: 0,
      take: 21,
    });
    expect(sql).not.toBeNull();
    const text = sql?.strings.join(' ') ?? '';
    expect(text).toContain('ILIKE');
    expect(text).toContain('LIMIT');
    expect(text).toContain('OFFSET');
    expect(text).toContain("p.tracking_type = 'QUANTITY'");
    expect(text).toContain('FROM inventory_units u');
    expect(text).toContain("u.status = 'IN_STOCK'");
  });

  it('uses lean path only for simple text search', () => {
    expect(canUseLeanProductSearch({ q: 'iphone 12' })).toBe(true);
    expect(canUseLeanProductSearch({ q: 'iphone 12', condition: 'NEW' })).toBe(
      false,
    );
    expect(canUseLeanProductSearch({ q: 'a' })).toBe(false);
  });
});

describe('toLeanMarketplaceProduct mapping', () => {
  const baseSerializedRow: MarketplaceProductSearchRow = {
    id: 'prod-serialized-1',
    name: 'iPhone 13',
    brand: 'Apple',
    category: 'Mobile Phones',
    tracking_type: 'SERIALIZED',
    model: 'iPhone 13',
    color: 'Midnight',
    ram: null,
    storage: '128GB',
    default_selling_price: 15000000n,
    low_stock_threshold: 2,
    pta_status: 'PTA_APPROVED',
    authenticity: null,
    public_description: 'Great condition phone',
    image_url: 'https://cdn.example.com/iphone13.jpg',
    qty: 0,
    slug: 'ronaq-mobiles',
    display_name: 'Ronaq Mobiles',
    city: 'Timergara',
    whatsapp_number: '03001234567',
    show_exact_stock: true,
  };

  it('returns OUT_OF_STOCK and stockCount 0 for serialized product with 0 in-stock units', () => {
    const result = toLeanMarketplaceProduct({
      ...baseSerializedRow,
      qty: 0,
    });

    expect(result.availability).toBe('OUT_OF_STOCK');
    expect(result.stockCount).toBe(0);
  });

  it('returns IN_STOCK for serialized product with in-stock units', () => {
    const result = toLeanMarketplaceProduct({
      ...baseSerializedRow,
      qty: 5,
    });

    expect(result.availability).toBe('IN_STOCK');
    expect(result.stockCount).toBe(5);
  });

  it('keeps stockCount null when show_exact_stock is false', () => {
    const result = toLeanMarketplaceProduct({
      ...baseSerializedRow,
      qty: 0,
      show_exact_stock: false,
    });

    expect(result.availability).toBe('OUT_OF_STOCK');
    expect(result.stockCount).toBeNull();
  });
});
