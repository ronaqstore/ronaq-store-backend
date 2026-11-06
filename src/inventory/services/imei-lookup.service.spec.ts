import { Test, TestingModule } from '@nestjs/testing';
import { ImeiLookupService } from './imei-lookup.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const SHOP_ID = '01924f0a-0000-7000-8000-000000000001';
const PRODUCT_ID = '01924f0a-0000-7000-8000-000000000002';
const UNIT_ID = '01924f0a-0000-7000-8000-000000000003';

describe('ImeiLookupService', () => {
  let service: ImeiLookupService;
  let prismaStub: {
    inventoryUnit: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaStub = {
      inventoryUnit: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImeiLookupService,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile();

    service = module.get<ImeiLookupService>(ImeiLookupService);
  });

  const mockFullProduct = {
    id: PRODUCT_ID,
    shopId: SHOP_ID,
    name: 'iPhone 14 Pro Max',
    trackingType: 'SERIALIZED',
    model: 'A2894',
    color: 'Deep Purple',
    ram: '6GB',
    storage: '256GB',
    sku: 'IP14PM-256-PUR',
    barcode: '194253401234',
    ptaStatus: 'PTA_APPROVED',
    defaultSellingPrice: 26000000n,
    brand: { name: 'Apple' },
    category: { name: 'Smartphones' },
  };

  const mockLookupUnit = {
    id: UNIT_ID,
    shopId: SHOP_ID,
    productId: PRODUCT_ID,
    imei1: '354892091234567',
    imei2: '354892091234568',
    condition: 'USED',
    status: 'SOLD',
    unitCost: 20000000n,
    askingPrice: 24000000n,
    batteryHealth: 92,
    defectNotes: 'Minor scratch',
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    product: mockFullProduct,
    purchaseItem: {
      purchase: {
        id: 'purch-1',
        purchaseNo: 'P-0015',
        purchaseDate: new Date('2026-10-01'),
        supplierInvoiceRef: 'INV-7721',
        supplier: {
          id: 'sup-1',
          name: 'Irfan Wholesale',
          phone: '03011234567',
        },
      },
    },
    consignment: null,
    saleItems: [
      {
        id: 'sale-item-1',
        unitPrice: 24000000n,
        unitCost: 20000000n,
        warrantyDays: 3,
        sale: {
          id: 'sale-1',
          saleNo: 'S-0042',
          saleDate: new Date('2026-10-10T12:00:00.000Z'),
          status: 'ACTIVE',
          customer: {
            id: 'cust-1',
            name: 'Zubair Khan',
            phone: '03029876543',
          },
        },
      },
    ],
    returnItems: [],
    movements: [
      {
        id: 'mov-1',
        type: 'PURCHASE',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        referenceType: 'PURCHASE',
        referenceId: 'purch-1',
        reason: null,
      },
      {
        id: 'mov-2',
        type: 'SALE',
        createdAt: new Date('2026-10-10T12:00:00.000Z'),
        referenceType: 'SALE',
        referenceId: 'sale-1',
        reason: null,
      },
    ],
  };

  it('Happy path: resolves full 360-degree lifecycle for a sold device', async () => {
    prismaStub.inventoryUnit.findFirst.mockResolvedValueOnce(mockLookupUnit);

    const result = await service.lookupImei('354892091234567', SHOP_ID);
    expect(result.found).toBe(true);
    expect(result.device?.productName).toBe('iPhone 14 Pro Max');
    expect(result.device?.status).toBe('SOLD');
    expect(result.device?.unitCost).toBe(20000000);
    expect(result.intake?.type).toBe('PURCHASE');
    expect(result.intake?.purchaseNo).toBe('P-0015');
    expect(result.intake?.supplierName).toBe('Irfan Wholesale');
    expect(result.latestSale?.saleNo).toBe('S-0042');
    expect(result.latestSale?.customerName).toBe('Zubair Khan');
    expect(result.latestSale?.salePrice).toBe(24000000);
    expect(result.latestSale?.profitAmount).toBe(4000000);
    expect(result.latestSale?.profitMarginPercent).toBe(16.7);
    expect(result.latestSale?.warrantyType).toBe('SHOP_WARRANTY');
    expect(result.timeline.length).toBe(2);
    expect(result.timeline[0].type).toBe('SALE');
    expect(result.timeline[1].type).toBe('PURCHASE');
  });

  it('Negative 1: returns found: false for empty or whitespace-only IMEI', async () => {
    const result = await service.lookupImei('   ', SHOP_ID);
    expect(result.found).toBe(false);
    expect(result.message).toContain('No IMEI provided');
    expect(result.timeline).toEqual([]);
  });

  it('Negative 2: returns found: false when IMEI does not exist in the shop', async () => {
    prismaStub.inventoryUnit.findFirst.mockResolvedValue(null);

    const result = await service.lookupImei('999999999999999', SHOP_ID);
    expect(result.found).toBe(false);
    expect(result.message).toContain('not found in this shop');
    expect(result.salesHistory).toEqual([]);
    expect(result.timeline).toEqual([]);
  });

  it('Negative 3: handles cancelled sale and consignment intake correctly without active warranty', async () => {
    const consignmentUnit = {
      ...mockLookupUnit,
      purchaseItem: null,
      consignment: {
        id: 'con-1',
        consignmentNo: 'CON-0002',
        intakeDate: new Date('2026-10-05'),
        consignorName: 'Bilal Ahmed',
        consignorPhone: '03331122334',
        agreedPayout: 18000000n,
      },
      saleItems: [
        {
          id: 'sale-item-2',
          unitPrice: 22000000n,
          unitCost: 18000000n,
          warrantyDays: 3,
          sale: {
            id: 'sale-cancelled-1',
            saleNo: 'S-0010',
            saleDate: new Date('2026-10-06T10:00:00.000Z'),
            status: 'CANCELLED',
            customer: null,
          },
        },
      ],
      status: 'IN_STOCK',
    };
    prismaStub.inventoryUnit.findFirst.mockResolvedValueOnce(consignmentUnit);

    const result = await service.lookupImei('354892091234567', SHOP_ID);
    expect(result.found).toBe(true);
    expect(result.intake?.type).toBe('CONSIGNMENT');
    expect(result.intake?.consignmentNo).toBe('CON-0002');
    expect(result.intake?.consignorName).toBe('Bilal Ahmed');
    expect(result.latestSale?.saleStatus).toBe('CANCELLED');
    expect(result.latestSale?.isWarrantyActive).toBe(false);
  });
});
