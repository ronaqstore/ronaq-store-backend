import { productThumbnailUrl } from './product-image-variants.helper.js';

describe('productThumbnailUrl', () => {
  it('maps the display WebP variant to its 400px thumbnail', () => {
    expect(
      productThumbnailUrl('https://cdn.example.com/products/phone-800.webp'),
    ).toBe('https://cdn.example.com/products/phone-400.webp');
  });

  it('keeps legacy images unchanged', () => {
    expect(
      productThumbnailUrl('https://cdn.example.com/products/phone.jpg'),
    ).toBe('https://cdn.example.com/products/phone.jpg');
  });
});
