import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MarketplaceService } from './marketplace.service.js';
import { MarketplaceSearchCacheService } from './marketplace-search-cache.service.js';
import type { MarketplaceProductSearchRow } from '../helpers/marketplace-product-search.helper.js';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let prisma: {
    $queryRaw: jest.Mock;
    product: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  let searchCache: MarketplaceSearchCacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        MarketplaceSearchCacheService,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
            product: {
              findMany: jest.fn(),
              count: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MarketplaceService>(MarketplaceService);
    prisma = module.get(PrismaService);
    searchCache = module.get<MarketplaceSearchCacheService>(
      MarketplaceSearchCacheService,
    );
    searchCache.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listProducts (lean search for serialized products)', () => {
    const serializedProductRow: MarketplaceProductSearchRow = {
      id: 'phone-uuid-1',
      name: 'iPhone 13 Pro',
      brand: 'Apple',
      category: 'Mobile Phones',
      tracking_type: 'SERIALIZED',
      model: 'iPhone 13 Pro',
      color: 'Graphite',
      ram: null,
      storage: '256GB',
      default_selling_price: 18000000n,
      low_stock_threshold: 2,
      pta_status: 'PTA_APPROVED',
      authenticity: null,
      public_description: 'Box pack phone',
      image_url: 'https://cdn.example.com/iphone.jpg',
      qty: 0,
      slug: 'tech-hub',
      display_name: 'Tech Hub',
      city: 'Timergara',
      whatsapp_number: '03001234567',
      show_exact_stock: true,
    };

    it('returns OUT_OF_STOCK and stockCount 0 when serialized product has 0 in-stock units', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          ...serializedProductRow,
          qty: 0,
        },
      ]);

      const result = await service.listProducts({
        q: 'iphone 13',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.id).toBe('phone-uuid-1');
      expect(item.trackingType).toBe('SERIALIZED');
      expect(item.availability).toBe('OUT_OF_STOCK');
      expect(item.stockCount).toBe(0);
    });

    it('returns IN_STOCK and stockCount 5 when serialized product has in-stock units', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          ...serializedProductRow,
          qty: 5,
        },
      ]);

      const result = await service.listProducts({
        q: 'iphone 13',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.availability).toBe('IN_STOCK');
      expect(item.stockCount).toBe(5);
    });

    it('returns stockCount null when show_exact_stock is false', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          ...serializedProductRow,
          qty: 0,
          show_exact_stock: false,
        },
      ]);

      const result = await service.listProducts({
        q: 'iphone 13',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.availability).toBe('OUT_OF_STOCK');
      expect(item.stockCount).toBeNull();
    });
  });
});
