import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';
import { storefrontRevalidateStub } from '../../../test/stubs/storefront-revalidate.stub.js';

const CATEGORY_ID = '01924f0a-0000-7000-8000-0000000000c1';
const BRAND_ID = '01924f0a-0000-7000-8000-0000000000b1';
const OTHER_BRAND_ID = '01924f0a-0000-7000-8000-0000000000b2';
const SHOP_ID = 'shop-1';

const prismaStub = {
  product: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  category: { findFirst: jest.fn() },
  brand: { findFirst: jest.fn() },
  stockLevel: {
    create: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
  purchaseItem: { count: jest.fn() },
  saleItem: { count: jest.fn() },
  productImage: { count: jest.fn() },
  $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) =>
    fn(prismaStub),
  ),
};

function uniqueViolation(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.0.0',
    meta: { target },
  });
}

/**
 * The shape Prisma 7 + @prisma/adapter-pg actually produces: there is NO
 * meta.target, only the nested Postgres constraint index name. This is the
 * path every live request takes, so it must be covered.
 */
function adapterUniqueViolation(indexName: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.0.0',
    meta: {
      modelName: 'Product',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '23505',
          kind: 'UniqueConstraintViolation',
          constraint: { index: indexName },
          table: 'products',
        },
      },
    },
  });
}

function baseProductRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    shopId: SHOP_ID,
    categoryId: CATEGORY_ID,
    brandId: BRAND_ID,
    name: 'Galaxy A15',
    trackingType: 'QUANTITY',
    model: 'SM-A155F',
    color: null,
    ram: null,
    storage: null,
    sku: null,
    barcode: null,
    description: null,
    imageUrl: null,
    defaultPurchasePrice: 4500000n,
    defaultSellingPrice: 699900n,
    lowStockThreshold: 3,
    isActive: true,
    createdAt: new Date('2026-10-05T09:20:00.000Z'),
    updatedAt: new Date('2026-10-05T09:20:00.000Z'),
    category: { name: 'Accessories' },
    brand: { name: 'Samsung' },
    stockLevel: { quantityOnHand: 7 },
    images: [],
    _count: { inventoryUnits: 0 },
    ...overrides,
  };
}

const validCreate = {
  name: 'Galaxy A15',
  categoryId: CATEGORY_ID,
  brandId: BRAND_ID,
  trackingType: 'QUANTITY' as const,
};

/** Existing row for update, then null for the name+variant uniqueness probe. */
function mockProductFoundForUpdate(
  row: Record<string, unknown> = baseProductRow(),
) {
  prismaStub.product.findFirst.mockImplementation((args?: any) => {
    const idFilter = args?.where?.id;
    if (idFilter && typeof idFilter === 'object' && idFilter.not) {
      return Promise.resolve(null);
    }
    if (idFilter) return Promise.resolve(row);
    return Promise.resolve(null);
  });
}

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaStub.category.findFirst.mockResolvedValue({ id: CATEGORY_ID });
    prismaStub.brand.findFirst.mockResolvedValue({
      id: BRAND_ID,
      name: 'Samsung',
    });
    // Default: no name+variant clash (create / update uniqueness probe).
    prismaStub.product.findFirst.mockResolvedValue(null);
    prismaStub.productImage.count.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prismaStub },
        {
          provide: StorefrontRevalidateService,
          useValue: storefrontRevalidateStub,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProduct', () => {
    it('creates a stock_levels row for a QUANTITY product', async () => {
      prismaStub.product.create.mockResolvedValue({ id: 'prod-1' });

      await service.createProduct(validCreate, SHOP_ID, 'user-1');

      expect(prismaStub.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shopId: SHOP_ID,
            name: 'Galaxy A15',
            trackingType: 'QUANTITY',
          }),
        }),
      );
      expect(prismaStub.stockLevel.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod-1',
          shopId: SHOP_ID,
          quantityOnHand: 0,
          avgUnitCost: 0,
        },
      });
    });

    it('creates no stock_levels row for a SERIALIZED product', async () => {
      prismaStub.product.create.mockResolvedValue({ id: 'prod-2' });

      await service.createProduct(
        { ...validCreate, trackingType: 'SERIALIZED' },
        SHOP_ID,
        'user-1',
      );

      expect(prismaStub.stockLevel.create).not.toHaveBeenCalled();
    });

    it('rejects a category owned by another shop', async () => {
      prismaStub.category.findFirst.mockResolvedValue(null);

      await expect(
        service.createProduct(validCreate, SHOP_ID, 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prismaStub.product.create).not.toHaveBeenCalled();
    });

    it('rejects a brand owned by another shop', async () => {
      prismaStub.brand.findFirst.mockResolvedValue(null);

      await expect(
        service.createProduct(validCreate, SHOP_ID, 'user-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prismaStub.product.create).not.toHaveBeenCalled();
    });

    it('scopes the ownership lookup to the shop in the JWT', async () => {
      prismaStub.product.create.mockResolvedValue({ id: 'prod-1' });

      await service.createProduct(validCreate, 'shop-2', 'user-1');

      expect(prismaStub.category.findFirst).toHaveBeenCalledWith({
        where: { id: CATEGORY_ID, shopId: 'shop-2', isActive: true },
        select: { id: true },
      });
      expect(prismaStub.brand.findFirst).toHaveBeenCalledWith({
        where: { id: BRAND_ID, shopId: 'shop-2', isActive: true },
        select: { id: true, name: true },
      });
    });

    it('allows the same product name when variant details differ', async () => {
      prismaStub.product.findFirst.mockResolvedValue(null);
      prismaStub.product.create.mockResolvedValue({ id: 'prod-new' });

      await expect(
        service.createProduct(
          {
            ...validCreate,
            name: 'iPhone 7',
            color: 'Black',
            storage: '64',
            trackingType: 'SERIALIZED',
          },
          SHOP_ID,
          'user-1',
        ),
      ).resolves.toMatchObject({ status: true });
    });

    it('rejects an exact name + variant duplicate with a friendly 400', async () => {
      prismaStub.product.findFirst.mockResolvedValue({ id: 'prod-existing' });

      await expect(
        service.createProduct(validCreate, SHOP_ID, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.create).not.toHaveBeenCalled();
    });

    it('allows creating identical names and attributes under DIFFERENT brand IDs', async () => {
      prismaStub.brand.findFirst.mockImplementation(({ where }: any) =>
        Promise.resolve({ id: where.id, name: 'Anker' }),
      );
      prismaStub.product.findFirst.mockImplementation(({ where }: any) => {
        if (where.brandId === BRAND_ID) {
          return Promise.resolve({ id: 'prod-brand-1' });
        }
        return Promise.resolve(null);
      });
      prismaStub.product.create.mockResolvedValue({ id: 'prod-new' });

      await expect(
        service.createProduct(
          {
            ...validCreate,
            brandId: OTHER_BRAND_ID,
            name: 'Fast Charger 20W White',
            color: 'White',
          },
          SHOP_ID,
          'user-1',
        ),
      ).resolves.toMatchObject({ status: true });

      expect(prismaStub.product.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          shopId: SHOP_ID,
          brandId: OTHER_BRAND_ID,
          isActive: true,
          name: { equals: 'Fast Charger 20W White', mode: 'insensitive' },
        }),
        select: { id: true },
      });
    });

    it('rejects creating identical names and attributes under the SAME brand ID', async () => {
      prismaStub.product.findFirst.mockResolvedValue({ id: 'prod-existing' });

      await expect(
        service.createProduct(
          {
            ...validCreate,
            brandId: BRAND_ID,
            name: 'Fast Charger 20W White',
            color: 'White',
          },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaStub.product.create).not.toHaveBeenCalled();
    });

    it('maps a duplicate SKU to a SKU-specific 400', async () => {
      prismaStub.product.create.mockRejectedValue(
        uniqueViolation(['shop_id', 'sku']),
      );

      const err = await service
        .createProduct({ ...validCreate, sku: 'A15-BLU' }, SHOP_ID, 'user-1')
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify(err.getResponse())).toContain('SKU');
    });

    it('maps a duplicate barcode to a barcode-specific 400', async () => {
      prismaStub.product.create.mockRejectedValue(
        uniqueViolation(['shop_id', 'barcode']),
      );

      const err = await service
        .createProduct(
          { ...validCreate, barcode: '356938035643809' },
          SHOP_ID,
          'user-1',
        )
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify(err.getResponse())).toContain('barcode');
    });

    it('rethrows errors that are not unique violations', async () => {
      prismaStub.product.create.mockRejectedValue(new Error('boom'));

      await expect(
        service.createProduct(validCreate, SHOP_ID, 'user-1'),
      ).rejects.toThrow('boom');
    });

    describe('with the Prisma 7 driver-adapter error shape (meta.target absent)', () => {
      it('reports a duplicate SKU, not a name clash', async () => {
        prismaStub.product.create.mockRejectedValue(
          adapterUniqueViolation('products_shop_id_sku_key'),
        );

        const err = await service
          .createProduct({ ...validCreate, sku: 'A15-BLU' }, SHOP_ID, 'user-1')
          .catch((e) => e);

        expect(err).toBeInstanceOf(BadRequestException);
        expect(JSON.stringify(err.getResponse())).toContain('SKU');
      });

      it('reports a duplicate barcode, not a name clash', async () => {
        prismaStub.product.create.mockRejectedValue(
          adapterUniqueViolation('products_shop_id_barcode_key'),
        );

        const err = await service
          .createProduct(
            { ...validCreate, barcode: '356938035643809' },
            SHOP_ID,
            'user-1',
          )
          .catch((e) => e);

        expect(err).toBeInstanceOf(BadRequestException);
        expect(JSON.stringify(err.getResponse())).toContain('barcode');
      });

      it('reports a duplicate variant when products_variant_key violates', async () => {
        prismaStub.product.findFirst.mockResolvedValue(null);
        prismaStub.product.create.mockRejectedValue(
          adapterUniqueViolation('products_variant_key'),
        );

        const err = await service
          .createProduct(validCreate, SHOP_ID, 'user-1')
          .catch((e) => e);

        expect(err).toBeInstanceOf(BadRequestException);
        expect(JSON.stringify(err.getResponse())).toContain(
          'with these variant details already exists',
        );
      });
    });

    it('rejects a duplicate variant when case differs', async () => {
      prismaStub.product.findFirst.mockImplementation((args?: any) => {
        if (
          args?.where?.name?.equals === 'galaxy a15' ||
          args?.where?.model?.equals === 'sm-a155f'
        ) {
          return Promise.resolve({ id: 'prod-existing' });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.createProduct(
          { ...validCreate, name: 'galaxy a15', model: 'sm-a155f' },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate variant when whitespace needs trimming', async () => {
      prismaStub.product.findFirst.mockImplementation((args?: any) => {
        if (
          args?.where?.name?.equals === 'Galaxy A15' &&
          args?.where?.model?.equals === 'SM-A155F'
        ) {
          return Promise.resolve({ id: 'prod-existing' });
        }
        return Promise.resolve(null);
      });

      await expect(
        service.createProduct(
          { ...validCreate, name: '  Galaxy A15  ', model: '  SM-A155F  ' },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.create).not.toHaveBeenCalled();
    });

    it('allows creating a product with a different color', async () => {
      prismaStub.product.findFirst.mockResolvedValue(null);
      prismaStub.product.create.mockResolvedValue({ id: 'prod-2' });

      await expect(
        service.createProduct(
          { ...validCreate, color: 'White' },
          SHOP_ID,
          'user-1',
        ),
      ).resolves.toMatchObject({ status: true });
      expect(prismaStub.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ color: 'White' }),
        }),
      );
    });

    it('handles concurrent create (two parallel calls) with one success and one duplicate error', async () => {
      prismaStub.product.findFirst.mockResolvedValue(null);

      let callCount = 0;
      prismaStub.product.create.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ id: 'prod-first' });
        }
        return Promise.reject(adapterUniqueViolation('products_variant_key'));
      });

      const [res1, res2] = await Promise.allSettled([
        service.createProduct(validCreate, SHOP_ID, 'user-1'),
        service.createProduct(validCreate, SHOP_ID, 'user-1'),
      ]);

      expect(res1.status === 'fulfilled' || res2.status === 'fulfilled').toBe(
        true,
      );
      expect(res1.status === 'rejected' || res2.status === 'rejected').toBe(
        true,
      );

      const rejected = (
        res1.status === 'rejected' ? res1 : res2
      ) as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify(rejected.reason.getResponse())).toContain(
        'with these variant details already exists',
      );
    });
  });

  describe('getProducts', () => {
    it('scopes every list query to the shop in the JWT', async () => {
      prismaStub.product.findMany.mockResolvedValue([]);
      prismaStub.product.count.mockResolvedValue(0);

      await service.getProducts({ page: 1, pageSize: 10 }, SHOP_ID);

      expect(prismaStub.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { shopId: SHOP_ID } }),
      );
      expect(prismaStub.product.count).toHaveBeenCalledWith({
        where: { shopId: SHOP_ID },
      });
    });

    it('ANDs the search across name, model, sku and barcode without widening shop scope', async () => {
      prismaStub.product.findMany.mockResolvedValue([]);
      prismaStub.product.count.mockResolvedValue(0);

      await service.getProducts(
        { page: 1, pageSize: 10, search: '  a15 ' },
        SHOP_ID,
      );

      const { where } = prismaStub.product.findMany.mock.calls[0][0];
      expect(where.shopId).toBe(SHOP_ID);
      expect(where.AND).toEqual([
        {
          OR: [
            { name: { contains: 'a15', mode: 'insensitive' } },
            { model: { contains: 'a15', mode: 'insensitive' } },
            { sku: { contains: 'a15', mode: 'insensitive' } },
            { barcode: { contains: 'a15', mode: 'insensitive' } },
          ],
        },
      ]);
    });

    it('passes category, brand, trackingType and isActive filters through', async () => {
      prismaStub.product.findMany.mockResolvedValue([]);
      prismaStub.product.count.mockResolvedValue(0);

      await service.getProducts(
        {
          page: 1,
          pageSize: 10,
          categoryId: CATEGORY_ID,
          brandId: BRAND_ID,
          trackingType: 'SERIALIZED',
          isActive: false,
        },
        SHOP_ID,
      );

      expect(prismaStub.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId: SHOP_ID,
            categoryId: CATEGORY_ID,
            brandId: BRAND_ID,
            trackingType: 'SERIALIZED',
            isActive: false,
          },
        }),
      );
    });

    it('filters by isPublished and selling price range in paisa', async () => {
      prismaStub.product.findMany.mockResolvedValue([]);
      prismaStub.product.count.mockResolvedValue(0);

      await service.getProducts(
        {
          page: 1,
          pageSize: 10,
          isPublished: true,
          minSellingPrice: 5_000_000,
          maxSellingPrice: 15_000_000,
        },
        SHOP_ID,
      );

      expect(prismaStub.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId: SHOP_ID,
            isPublished: true,
            defaultSellingPrice: {
              gte: 5_000_000,
              lte: 15_000_000,
            },
          },
        }),
      );
    });

    it('filters to in-stock products when inStockOnly is true', async () => {
      prismaStub.product.findMany.mockResolvedValue([]);
      prismaStub.product.count.mockResolvedValue(0);

      await service.getProducts(
        { page: 1, pageSize: 10, inStockOnly: true },
        SHOP_ID,
      );

      const { where } = prismaStub.product.findMany.mock.calls[0][0];
      expect(where.shopId).toBe(SHOP_ID);
      expect(where.AND).toEqual([
        {
          OR: [
            {
              trackingType: 'QUANTITY',
              stockLevel: { quantityOnHand: { gt: 0 } },
            },
            {
              trackingType: 'SERIALIZED',
              inventoryUnits: { some: { status: 'IN_STOCK' } },
            },
          ],
        },
      ]);
    });

    it('returns stock_levels quantity for a QUANTITY product', async () => {
      prismaStub.product.findMany.mockResolvedValue([
        baseProductRow({
          trackingType: 'QUANTITY',
          stockLevel: { quantityOnHand: 7 },
        }),
      ]);
      prismaStub.product.count.mockResolvedValue(1);

      const res = await service.getProducts({ page: 1, pageSize: 10 }, SHOP_ID);

      expect(res.items[0].quantityOnHand).toBe(7);
      expect(res.items[0].categoryName).toBe('Accessories');
      expect(res.items[0].brandName).toBe('Samsung');
      expect(res.items[0].defaultPurchasePrice).toBe(4500000);
    });

    it('returns the IN_STOCK unit count for a SERIALIZED product', async () => {
      prismaStub.product.findMany.mockResolvedValue([
        baseProductRow({
          trackingType: 'SERIALIZED',
          stockLevel: null,
          _count: { inventoryUnits: 4 },
        }),
      ]);
      prismaStub.product.count.mockResolvedValue(1);

      const res = await service.getProducts({ page: 1, pageSize: 10 }, SHOP_ID);

      expect(res.items[0].quantityOnHand).toBe(4);
    });
  });

  describe('getProductById', () => {
    it('finds the product scoped to the shop', async () => {
      prismaStub.product.findFirst.mockResolvedValue(baseProductRow());

      await service.getProductById('prod-1', SHOP_ID);

      expect(prismaStub.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prod-1', shopId: SHOP_ID } }),
      );
    });

    it('returns 404 when the product belongs to another shop', async () => {
      prismaStub.product.findFirst.mockResolvedValue(null);

      await expect(service.getProductById('prod-1', SHOP_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProduct', () => {
    it('returns 404 when no row matches the shop', async () => {
      prismaStub.product.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProduct('prod-1', { name: 'New' }, SHOP_ID, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a category owned by another shop', async () => {
      prismaStub.product.findFirst.mockResolvedValue(baseProductRow());
      prismaStub.category.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProduct(
          'prod-1',
          { categoryId: CATEGORY_ID },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prismaStub.product.update).not.toHaveBeenCalled();
    });

    it('blocks a trackingType change once purchase history exists', async () => {
      prismaStub.product.findFirst.mockResolvedValue(
        baseProductRow({ trackingType: 'QUANTITY' }),
      );
      prismaStub.purchaseItem.count.mockResolvedValue(2);
      prismaStub.saleItem.count.mockResolvedValue(0);

      await expect(
        service.updateProduct(
          'prod-1',
          { trackingType: 'SERIALIZED' },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.update).not.toHaveBeenCalled();
    });

    it('blocks a trackingType change once sale history exists', async () => {
      prismaStub.product.findFirst.mockResolvedValue(
        baseProductRow({ trackingType: 'SERIALIZED' }),
      );
      prismaStub.purchaseItem.count.mockResolvedValue(0);
      prismaStub.saleItem.count.mockResolvedValue(1);

      await expect(
        service.updateProduct(
          'prod-1',
          { trackingType: 'QUANTITY' },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks QUANTITY -> SERIALIZED while stock is still on hand', async () => {
      prismaStub.product.findFirst.mockResolvedValue(
        baseProductRow({ trackingType: 'QUANTITY' }),
      );
      prismaStub.purchaseItem.count.mockResolvedValue(0);
      prismaStub.saleItem.count.mockResolvedValue(0);
      prismaStub.stockLevel.findUnique.mockResolvedValue({ quantityOnHand: 5 });

      await expect(
        service.updateProduct(
          'prod-1',
          { trackingType: 'SERIALIZED' },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.update).not.toHaveBeenCalled();
    });

    it('drops the stock counter when switching QUANTITY -> SERIALIZED with no history and no stock', async () => {
      mockProductFoundForUpdate(baseProductRow({ trackingType: 'QUANTITY' }));
      prismaStub.purchaseItem.count.mockResolvedValue(0);
      prismaStub.saleItem.count.mockResolvedValue(0);
      prismaStub.stockLevel.findUnique.mockResolvedValue({ quantityOnHand: 0 });
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        { trackingType: 'SERIALIZED' },
        SHOP_ID,
        'user-1',
      );

      expect(prismaStub.stockLevel.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'prod-1' },
      });
    });

    it('creates a stock counter when switching SERIALIZED -> QUANTITY with no history', async () => {
      mockProductFoundForUpdate(baseProductRow({ trackingType: 'SERIALIZED' }));
      prismaStub.purchaseItem.count.mockResolvedValue(0);
      prismaStub.saleItem.count.mockResolvedValue(0);
      prismaStub.stockLevel.findUnique.mockResolvedValue(null);
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        { trackingType: 'QUANTITY' },
        SHOP_ID,
        'user-1',
      );

      expect(prismaStub.stockLevel.create).toHaveBeenCalledWith({
        data: {
          productId: 'prod-1',
          shopId: SHOP_ID,
          quantityOnHand: 0,
          avgUnitCost: 0,
        },
      });
    });

    it('does not touch stock levels when trackingType is unchanged', async () => {
      mockProductFoundForUpdate(baseProductRow({ trackingType: 'QUANTITY' }));
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        { name: 'Galaxy A15 v2', lowStockThreshold: 5 },
        SHOP_ID,
        'user-1',
      );

      expect(prismaStub.stockLevel.create).not.toHaveBeenCalled();
      expect(prismaStub.stockLevel.deleteMany).not.toHaveBeenCalled();
      expect(prismaStub.purchaseItem.count).not.toHaveBeenCalled();
      expect(prismaStub.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { name: 'Galaxy A15 v2', lowStockThreshold: 5 },
      });
    });

    it('rejects an exact name + variant duplicate on update', async () => {
      prismaStub.product.findFirst.mockImplementation((args?: any) => {
        const idFilter = args?.where?.id;
        if (idFilter && typeof idFilter === 'object' && idFilter.not) {
          return Promise.resolve({ id: 'prod-other' });
        }
        return Promise.resolve(baseProductRow());
      });

      await expect(
        service.updateProduct('prod-1', { name: 'Dup' }, SHOP_ID, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.update).not.toHaveBeenCalled();
    });

    it('allows price-only update without running variant uniqueness check', async () => {
      let variantCheckRan = false;
      prismaStub.product.findFirst.mockImplementation((args?: any) => {
        const idFilter = args?.where?.id;
        if (idFilter && typeof idFilter === 'object' && idFilter.not) {
          variantCheckRan = true;
          return Promise.resolve(null);
        }
        return Promise.resolve(baseProductRow());
      });
      prismaStub.product.update.mockResolvedValue({});

      await expect(
        service.updateProduct(
          'prod-1',
          { defaultSellingPrice: 899900n },
          SHOP_ID,
          'user-1',
        ),
      ).resolves.toMatchObject({ status: true });

      expect(variantCheckRan).toBe(false);
      expect(prismaStub.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1' },
          data: { defaultSellingPrice: 899900n },
        }),
      );
    });

    it('allows updating product to a different color when no clash exists', async () => {
      mockProductFoundForUpdate(baseProductRow({ color: 'Black' }));
      prismaStub.product.update.mockResolvedValue({});

      await expect(
        service.updateProduct('prod-1', { color: 'Blue' }, SHOP_ID, 'user-1'),
      ).resolves.toMatchObject({ status: true });

      expect(prismaStub.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1' },
          data: expect.objectContaining({ color: 'Blue' }),
        }),
      );
    });

    it('runs variant uniqueness check when brandId changes on update', async () => {
      let queriedBrandId: string | undefined;
      prismaStub.brand.findFirst.mockResolvedValue({
        id: OTHER_BRAND_ID,
        name: 'Anker',
      });
      prismaStub.product.findFirst.mockImplementation((args?: any) => {
        const idFilter = args?.where?.id;
        if (idFilter && typeof idFilter === 'object' && idFilter.not) {
          queriedBrandId = args.where.brandId;
          return Promise.resolve(null);
        }
        return Promise.resolve(baseProductRow({ brandId: BRAND_ID }));
      });
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        { brandId: OTHER_BRAND_ID },
        SHOP_ID,
        'user-1',
      );

      expect(queriedBrandId).toBe(OTHER_BRAND_ID);
    });

    it('runs variant uniqueness check when reactivating an inactive product', async () => {
      let variantCheckRan = false;
      prismaStub.product.findFirst.mockImplementation((args?: any) => {
        const idFilter = args?.where?.id;
        if (idFilter && typeof idFilter === 'object' && idFilter.not) {
          variantCheckRan = true;
          return Promise.resolve(null);
        }
        return Promise.resolve(baseProductRow({ isActive: false }));
      });
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        { isActive: true },
        SHOP_ID,
        'user-1',
      );

      expect(variantCheckRan).toBe(true);
    });

    it('maps database unique-index violation (products_variant_key) on update to 400', async () => {
      mockProductFoundForUpdate(baseProductRow());
      prismaStub.product.update.mockRejectedValue(
        adapterUniqueViolation('products_variant_key'),
      );

      const err = await service
        .updateProduct('prod-1', { color: 'Red' }, SHOP_ID, 'user-1')
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify(err.getResponse())).toContain(
        'with these variant details already exists',
      );
    });

    it('writes the R1.2 publish fields and never touches publishedAt', async () => {
      mockProductFoundForUpdate(baseProductRow({ trackingType: 'SERIALIZED' }));
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        {
          isPublished: true,
          publicDescription: '  Box pack.  ',
          ptaStatus: 'NON_PTA',
        },
        SHOP_ID,
        'user-1',
      );

      expect(prismaStub.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPublished: true,
            publicDescription: 'Box pack.',
            ptaStatus: 'NON_PTA',
          }),
        }),
      );
      const data = prismaStub.product.update.mock.calls[0][0].data as object;
      expect('publishedAt' in data).toBe(false);
    });

    it('refuses to publish a product that is inactive (WF20)', async () => {
      prismaStub.product.findFirst.mockResolvedValue(
        baseProductRow({ isActive: false }),
      );

      await expect(
        service.updateProduct(
          'prod-1',
          { isPublished: true },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.update).not.toHaveBeenCalled();
    });

    it('refuses publish + deactivate in the same request', async () => {
      prismaStub.product.findFirst.mockResolvedValue(
        baseProductRow({ isActive: true }),
      );

      await expect(
        service.updateProduct(
          'prod-1',
          { isActive: false, isPublished: true },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.update).not.toHaveBeenCalled();
    });

    it('refuses to publish a product with zero images on update', async () => {
      mockProductFoundForUpdate(baseProductRow({ isActive: true }));
      prismaStub.productImage.count.mockResolvedValue(0);

      await expect(
        service.updateProduct(
          'prod-1',
          { isPublished: true },
          SHOP_ID,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.update).not.toHaveBeenCalled();
    });

    it('clears optional fields (sku, barcode, model, color, ram, storage, description, imageUrl, publicDescription) to null when null is provided', async () => {
      mockProductFoundForUpdate(
        baseProductRow({
          sku: 'OLD-SKU',
          barcode: 'OLD-BARCODE',
          model: 'SM-OLD',
          color: 'Red',
          ram: '4GB',
          storage: '64GB',
          description: 'Old desc',
          imageUrl: 'https://cdn.example.com/old.png',
          publicDescription: 'Old public desc',
        }),
      );
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        {
          sku: null,
          barcode: null,
          model: null,
          color: null,
          ram: null,
          storage: null,
          description: null,
          imageUrl: null,
          publicDescription: null,
        },
        SHOP_ID,
        'user-1',
      );

      expect(prismaStub.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1' },
          data: expect.objectContaining({
            sku: null,
            barcode: null,
            model: null,
            color: null,
            ram: null,
            storage: null,
            description: null,
            imageUrl: null,
            publicDescription: null,
          }),
        }),
      );
    });

    it('clears optional fields to null when whitespace-only strings are provided', async () => {
      mockProductFoundForUpdate(
        baseProductRow({
          sku: 'OLD-SKU',
          barcode: 'OLD-BARCODE',
          description: 'Old desc',
        }),
      );
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        {
          sku: '   ',
          barcode: '   ',
          description: '   ',
        },
        SHOP_ID,
        'user-1',
      );

      expect(prismaStub.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1' },
          data: expect.objectContaining({
            sku: null,
            barcode: null,
            description: null,
          }),
        }),
      );
    });

    it('updates sku and barcode to trimmed string values when valid strings are provided', async () => {
      mockProductFoundForUpdate(baseProductRow());
      prismaStub.product.update.mockResolvedValue({});

      await service.updateProduct(
        'prod-1',
        {
          sku: '  A15-NEW-SKU  ',
          barcode: '  9876543210  ',
        },
        SHOP_ID,
        'user-1',
      );

      expect(prismaStub.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-1' },
          data: expect.objectContaining({
            sku: 'A15-NEW-SKU',
            barcode: '9876543210',
          }),
        }),
      );
    });
  });

  describe('publishProducts (bulk, WF20)', () => {
    it('flips the whole selection in one transaction', async () => {
      prismaStub.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Galaxy A15',
          isActive: true,
          _count: { images: 1 },
        },
        {
          id: 'p2',
          name: 'iPhone 14',
          isActive: true,
          _count: { images: 2 },
        },
      ]);

      const res = await service.publishProducts(
        { ids: ['p1', 'p2'], isPublished: true },
        SHOP_ID,
      );

      expect(prismaStub.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2'] }, shopId: SHOP_ID },
        data: { isPublished: true },
      });
      expect(res.message).toBe('2 products published successfully');
    });

    it('404s a foreign id instead of silently skipping it', async () => {
      prismaStub.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Galaxy A15',
          isActive: true,
          _count: { images: 1 },
        },
      ]);

      await expect(
        service.publishProducts(
          { ids: ['p1', 'foreign-id'], isPublished: true },
          SHOP_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prismaStub.product.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to bulk-publish an inactive product', async () => {
      prismaStub.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Galaxy A15',
          isActive: false,
          _count: { images: 1 },
        },
      ]);

      await expect(
        service.publishProducts({ ids: ['p1'], isPublished: true }, SHOP_ID),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.updateMany).not.toHaveBeenCalled();
    });

    it('refuses to bulk-publish products with zero images', async () => {
      prismaStub.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Galaxy A15',
          isActive: true,
          _count: { images: 0 },
        },
      ]);

      await expect(
        service.publishProducts({ ids: ['p1'], isPublished: true }, SHOP_ID),
      ).rejects.toThrow(BadRequestException);
      expect(prismaStub.product.updateMany).not.toHaveBeenCalled();
    });

    it('bulk-unpublish does not care about isActive', async () => {
      prismaStub.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Galaxy A15',
          isActive: false,
          _count: { images: 0 },
        },
      ]);

      const res = await service.publishProducts(
        { ids: ['p1'], isPublished: false },
        SHOP_ID,
      );

      expect(prismaStub.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1'] }, shopId: SHOP_ID },
        data: { isPublished: false },
      });
      expect(res.message).toBe('1 product unpublished successfully');
    });
  });

  describe('deleteProduct', () => {
    it('soft-deactivates only a product owned by the shop', async () => {
      prismaStub.product.updateMany.mockResolvedValue({ count: 1 });

      await service.deleteProduct('prod-1', SHOP_ID, 'user-1');

      expect(prismaStub.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'prod-1', shopId: SHOP_ID },
        data: { isActive: false, isPublished: false },
      });
    });

    it('returns 404 when no row matches the shop', async () => {
      prismaStub.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.deleteProduct('prod-1', SHOP_ID, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
