import { Test, TestingModule } from '@nestjs/testing';
import { DeadStockReportService } from './dead-stock-report.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UnitCondition, UnitStatus } from '../../generated/prisma/enums.js';

const SHOP_ID = '01924f0a-0000-7000-8000-000000000001';
const BRAND_ID = '01924f0a-0000-7000-8000-000000000002';

describe('DeadStockReportService', () => {
  let service: DeadStockReportService;
  let prismaStub: {
    inventoryUnit: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaStub = {
      inventoryUnit: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeadStockReportService,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile();

    service = module.get<DeadStockReportService>(DeadStockReportService);
  });

  const mockProduct = {
    id: 'prod-1',
    name: 'iPhone 14 Pro Max',
    model: 'A2894',
    color: 'Deep Purple',
    storage: '256GB',
    ram: '6GB',
    sku: 'IP14PM-256',
    ptaStatus: 'PTA_APPROVED',
    defaultSellingPrice: 24000000n,
    brand: { id: BRAND_ID, name: 'Apple' },
    category: { id: 'cat-1', name: 'Smartphones' },
  };

  it('Happy path: accurately groups aging buckets, computes totals, and sorts oldest first', async () => {
    const now = new Date();
    const date5DaysAgo = new Date(now.getTime() - 5 * 86400000);
    const date25DaysAgo = new Date(now.getTime() - 25 * 86400000);
    const date75DaysAgo = new Date(now.getTime() - 75 * 86400000);

    const mockUnits = [
      {
        id: 'u-1',
        shopId: SHOP_ID,
        productId: 'prod-1',
        imei1: '111111111111111',
        imei2: null,
        condition: UnitCondition.USED,
        status: UnitStatus.IN_STOCK,
        unitCost: 2000000n,
        batteryHealth: 95,
        askingPrice: 2500000n,
        defectNotes: null,
        createdAt: date5DaysAgo,
        product: mockProduct,
        purchaseItem: {
          purchase: {
            id: 'p-1',
            purchaseNo: 'P-0001',
            purchaseDate: date5DaysAgo,
            supplier: { name: 'Supplier A' },
          },
        },
        consignment: null,
      },
      {
        id: 'u-2',
        shopId: SHOP_ID,
        productId: 'prod-1',
        imei1: '222222222222222',
        imei2: null,
        condition: UnitCondition.USED,
        status: UnitStatus.IN_STOCK,
        unitCost: 5000000n,
        batteryHealth: 90,
        askingPrice: null,
        defectNotes: null,
        createdAt: date25DaysAgo,
        product: mockProduct,
        purchaseItem: null,
        consignment: {
          id: 'c-1',
          consignmentNo: 'C-0001',
          intakeDate: date25DaysAgo,
          consignorName: 'Customer B',
        },
      },
      {
        id: 'u-3',
        shopId: SHOP_ID,
        productId: 'prod-1',
        imei1: '333333333333333',
        imei2: null,
        condition: UnitCondition.NEW,
        status: UnitStatus.IN_STOCK,
        unitCost: 8000000n,
        batteryHealth: null,
        askingPrice: 9000000n,
        defectNotes: null,
        createdAt: date75DaysAgo,
        product: mockProduct,
        purchaseItem: {
          purchase: {
            id: 'p-2',
            purchaseNo: 'P-0002',
            purchaseDate: date75DaysAgo,
            supplier: { name: 'Supplier C' },
          },
        },
        consignment: null,
      },
    ];

    prismaStub.inventoryUnit.findMany.mockResolvedValueOnce(mockUnits);

    const result = await service.getDeadStockReport({}, SHOP_ID);

    expect(result.summary.totalInStockUnits).toBe(3);
    expect(result.summary.totalStockValue).toBe(15000000);
    expect(result.summary.deadStockCount).toBe(1);
    expect(result.summary.deadStockCostValue).toBe(8000000);
    expect(result.summary.averageDaysOnShelf).toBeGreaterThanOrEqual(30);

    const b0 = result.summary.buckets.find((b) => b.bucket === '0-15');
    const b1 = result.summary.buckets.find((b) => b.bucket === '16-30');
    const b2 = result.summary.buckets.find((b) => b.bucket === '31-60');
    const b3 = result.summary.buckets.find((b) => b.bucket === '60+');

    expect(b0?.count).toBe(1);
    expect(b0?.costValue).toBe(2000000);
    expect(b1?.count).toBe(1);
    expect(b1?.costValue).toBe(5000000);
    expect(b2?.count).toBe(0);
    expect(b2?.costValue).toBe(0);
    expect(b3?.count).toBe(1);
    expect(b3?.costValue).toBe(8000000);

    expect(result.pagination.total).toBe(3);
    expect(result.pagination.items[0].id).toBe('u-3');
    expect(result.pagination.items[0].agingBucket).toBe('60+');
    expect(result.pagination.items[0].effectivePrice).toBe(9000000);
    expect(result.pagination.items[1].id).toBe('u-2');
    expect(result.pagination.items[1].effectivePrice).toBe(24000000);
  });

  it('Negative 1: returns zeroed summary and safe defaults for empty stock', async () => {
    prismaStub.inventoryUnit.findMany.mockResolvedValueOnce([]);

    const result = await service.getDeadStockReport({}, SHOP_ID);

    expect(result.summary.totalInStockUnits).toBe(0);
    expect(result.summary.totalStockValue).toBe(0);
    expect(result.summary.deadStockCount).toBe(0);
    expect(result.summary.deadStockCostValue).toBe(0);
    expect(result.summary.averageDaysOnShelf).toBe(0);
    expect(Number.isNaN(result.summary.averageDaysOnShelf)).toBe(false);

    expect(result.pagination.items).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('Negative 2: filters by aging bucket and condition without altering global summary', async () => {
    const now = new Date();
    const date75DaysAgo = new Date(now.getTime() - 75 * 86400000);
    const date5DaysAgo = new Date(now.getTime() - 5 * 86400000);

    const mockUnits = [
      {
        id: 'u-1',
        shopId: SHOP_ID,
        productId: 'prod-1',
        imei1: '111111111111111',
        imei2: null,
        condition: UnitCondition.USED,
        status: UnitStatus.IN_STOCK,
        unitCost: 2000000n,
        batteryHealth: 95,
        askingPrice: null,
        defectNotes: null,
        createdAt: date5DaysAgo,
        product: mockProduct,
        purchaseItem: null,
        consignment: null,
      },
      {
        id: 'u-2',
        shopId: SHOP_ID,
        productId: 'prod-1',
        imei1: '222222222222222',
        imei2: null,
        condition: UnitCondition.NEW,
        status: UnitStatus.IN_STOCK,
        unitCost: 8000000n,
        batteryHealth: null,
        askingPrice: null,
        defectNotes: null,
        createdAt: date75DaysAgo,
        product: mockProduct,
        purchaseItem: null,
        consignment: null,
      },
    ];

    prismaStub.inventoryUnit.findMany.mockResolvedValueOnce(mockUnits);

    const result = await service.getDeadStockReport(
      { bucket: '60+', condition: 'NEW' },
      SHOP_ID,
    );

    expect(result.summary.totalInStockUnits).toBe(2);
    expect(result.summary.totalStockValue).toBe(10000000);
    expect(result.summary.deadStockCount).toBe(1);

    expect(result.pagination.total).toBe(1);
    expect(result.pagination.items.length).toBe(1);
    expect(result.pagination.items[0].id).toBe('u-2');
    expect(result.pagination.items[0].condition).toBe('NEW');
    expect(result.pagination.items[0].agingBucket).toBe('60+');
  });

  it('Negative 3: filters search query correctly and isolates by tenant', async () => {
    const now = new Date();
    const date10DaysAgo = new Date(now.getTime() - 10 * 86400000);

    const mockUnits = [
      {
        id: 'u-1',
        shopId: SHOP_ID,
        productId: 'prod-1',
        imei1: '864501051234567',
        imei2: null,
        condition: UnitCondition.USED,
        status: UnitStatus.IN_STOCK,
        unitCost: 3000000n,
        batteryHealth: 88,
        askingPrice: null,
        defectNotes: null,
        createdAt: date10DaysAgo,
        product: mockProduct,
        purchaseItem: null,
        consignment: null,
      },
      {
        id: 'u-2',
        shopId: SHOP_ID,
        productId: 'prod-2',
        imei1: '354892099999999',
        imei2: null,
        condition: UnitCondition.USED,
        status: UnitStatus.IN_STOCK,
        unitCost: 4000000n,
        batteryHealth: 90,
        askingPrice: null,
        defectNotes: null,
        createdAt: date10DaysAgo,
        product: {
          ...mockProduct,
          name: 'Samsung Galaxy S23',
          model: 'SM-S911B',
        },
        purchaseItem: null,
        consignment: null,
      },
    ];

    prismaStub.inventoryUnit.findMany.mockResolvedValueOnce(mockUnits);

    const result = await service.getDeadStockReport(
      { search: 'Samsung' },
      SHOP_ID,
    );

    expect(result.pagination.total).toBe(1);
    expect(result.pagination.items[0].productName).toBe('Samsung Galaxy S23');
    expect(prismaStub.inventoryUnit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shopId: SHOP_ID,
          status: UnitStatus.IN_STOCK,
        }),
      }),
    );
  });
});
