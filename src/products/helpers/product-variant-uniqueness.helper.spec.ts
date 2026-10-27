import { BadRequestException } from '@nestjs/common';
import { assertNoDuplicateVariant } from './product-variant-uniqueness.helper.js';

describe('assertNoDuplicateVariant', () => {
  let prisma: any;
  const shopId = '01924f0a-0000-7000-8000-000000000001';

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
        }),
      }),
    );
  });
});
