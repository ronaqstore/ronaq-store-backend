import { BadRequestException } from '@nestjs/common';
import { assertNoDuplicateVariant } from './product-variant-uniqueness.helper.js';

describe('assertNoDuplicateVariant', () => {
  let prisma: any;
  const shopId = '01924f0a-0000-7000-8000-000000000001';
  const brandId = '01924f0a-0000-7000-8000-000000000002';
  const anotherBrandId = '01924f0a-0000-7000-8000-000000000003';

  beforeEach(() => {
    prisma = {
      product: {
        findFirst: jest.fn(),
      },
    };
  });

  it('rejects a duplicate variant when case is different (name and variant fields)', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'prod-1' });

    await expect(
      assertNoDuplicateVariant(prisma, shopId, {
        brandId,
        name: 'iPhone 13',
        model: 'A2633',
        color: 'Midnight',
        ram: '4GB',
        storage: '128GB',
        ptaStatus: 'PTA_APPROVED',
        authenticity: null,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        shopId,
        brandId,
        isActive: true,
        name: { equals: 'iPhone 13', mode: 'insensitive' },
        model: { equals: 'A2633', mode: 'insensitive' },
        color: { equals: 'Midnight', mode: 'insensitive' },
        ram: { equals: '4GB', mode: 'insensitive' },
        storage: { equals: '128GB', mode: 'insensitive' },
        ptaStatus: 'PTA_APPROVED',
        authenticity: null,
      },
      select: { id: true },
    });
  });

  it('rejects duplicate variant with untrimmed spaces', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'prod-1' });

    await expect(
      assertNoDuplicateVariant(prisma, shopId, {
        brandId,
        name: '  iPhone 13  ',
        model: '  A2633  ',
        color: '  Midnight  ',
        ram: '  4GB  ',
        storage: '  128GB  ',
        ptaStatus: null,
        authenticity: null,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: {
        shopId,
        brandId,
        isActive: true,
        name: { equals: 'iPhone 13', mode: 'insensitive' },
        model: { equals: 'A2633', mode: 'insensitive' },
        color: { equals: 'Midnight', mode: 'insensitive' },
        ram: { equals: '4GB', mode: 'insensitive' },
        storage: { equals: '128GB', mode: 'insensitive' },
        ptaStatus: null,
        authenticity: null,
      },
      select: { id: true },
    });
  });

  it('allows a variant when different color (no clash found)', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      assertNoDuplicateVariant(prisma, shopId, {
        brandId,
        name: 'iPhone 13',
        model: 'A2633',
        color: 'Starlight',
        ram: '4GB',
        storage: '128GB',
        ptaStatus: 'PTA_APPROVED',
        authenticity: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('excludes the given product id on update', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await assertNoDuplicateVariant(
      prisma,
      shopId,
      {
        brandId,
        name: 'iPhone 13',
        model: null,
        color: null,
        ram: null,
        storage: null,
        ptaStatus: null,
        authenticity: null,
      },
      'prod-current-id',
    );

    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'prod-current-id' },
          brandId,
          isActive: true,
        }),
      }),
    );
  });

  it('allows identical names and attributes under DIFFERENT brand IDs', async () => {
    // When queried with anotherBrandId, findFirst finds no clash
    prisma.product.findFirst.mockImplementation(({ where }: any) => {
      if (where.brandId === brandId) {
        return Promise.resolve({ id: 'prod-brand-1' });
      }
      return Promise.resolve(null);
    });

    await expect(
      assertNoDuplicateVariant(prisma, shopId, {
        brandId: anotherBrandId,
        name: 'Fast Charger 20W White',
        color: 'White',
      }),
    ).resolves.toBeUndefined();

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        shopId,
        brandId: anotherBrandId,
        isActive: true,
        name: { equals: 'Fast Charger 20W White', mode: 'insensitive' },
      }),
      select: { id: true },
    });
  });

  it('rejects identical names and attributes under the SAME brand ID', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'prod-existing' });

    await expect(
      assertNoDuplicateVariant(prisma, shopId, {
        brandId,
        name: 'Fast Charger 20W White',
        color: 'White',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        shopId,
        brandId,
        isActive: true,
        name: { equals: 'Fast Charger 20W White', mode: 'insensitive' },
      }),
      select: { id: true },
    });
  });
});
