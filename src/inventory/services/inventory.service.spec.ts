import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { InventoryAdjustmentService } from './inventory-adjustment.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';
import { storefrontRevalidateStub } from '../../../test/stubs/storefront-revalidate.stub.js';

const SHOP_ID = 'shop-1';
const PRODUCT_ID = 'prod-1';
const UNIT_ID = 'unit-1';

const prismaStub = {
  product: { findFirst: jest.fn() },
  stockLevel: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  inventoryUnit: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  inventoryMovement: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

interface TxStub {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  stockLevel: {
    findUnique: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
  };
  inventoryUnit: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  inventoryMovement: { create: jest.Mock };
}

function makeTx(overrides: Partial<TxStub> = {}): TxStub {
  const tx: TxStub = {
    $queryRaw: jest.fn().mockResolvedValue([
      {
        quantity_on_hand: 10,
        product_id: PRODUCT_ID,
        id: UNIT_ID,
        status: 'IN_STOCK',
        imei1: '1112233344555',
        imei2: null,
      },
    ]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    stockLevel: {
      findUnique: jest.fn().mockResolvedValue({ quantityOnHand: 6 }),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    inventoryUnit: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    inventoryMovement: {
      create: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
  return tx;
}

function quantityProduct() {
  return { id: PRODUCT_ID, name: 'USB Cable', trackingType: 'QUANTITY' };
}

function phoneProduct() {
  return { id: PRODUCT_ID, name: 'Samsung Galaxy', trackingType: 'SERIALIZED' };
}

function adjustmentRequest(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_ID,
    type: 'ADJUSTMENT',
    reason: 'Counting difference',
    countedQuantity: 13,
    ...overrides,
  } as any;
}

function writeOffRequest(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_ID,
    type: 'DAMAGED',
    reason: 'Broken in the box',
    quantity: 2,
    ...overrides,
  } as any;
}

function restoreRequest(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_ID,
    type: 'RESTORE',
    reason: 'Repaired and restored to stock',
    inventoryUnitId: UNIT_ID,
    ...overrides,
  } as any;
}

describe('InventoryService', () => {
  let service: InventoryService;
  let tx: TxStub;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        InventoryAdjustmentService,
        { provide: PrismaService, useValue: prismaStub },
        {
          provide: StorefrontRevalidateService,
          useValue: storefrontRevalidateStub,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);

    tx = makeTx();
    prismaStub.$transaction.mockImplementation((cb: (t: unknown) => unknown) =>
      cb(tx),
    );
    prismaStub.product.findFirst.mockResolvedValue(quantityProduct());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAdjustment — product gate', () => {
    it('404s when the product does not belong to this shop or is inactive', async () => {
      prismaStub.product.findFirst.mockResolvedValue(null);

      await expect(
        service.createAdjustment(adjustmentRequest(), SHOP_ID),
      ).rejects.toThrow(NotFoundException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('filters the product read by shopId from the JWT, never a body field', async () => {
      await service.createAdjustment(adjustmentRequest(), SHOP_ID);

      expect(prismaStub.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PRODUCT_ID, shopId: SHOP_ID, isActive: true },
        }),
      );
    });
  });

  describe('createAdjustment — shape rules (400 before any write)', () => {
    it('refuses ADJUSTMENT on a SERIALIZED product', async () => {
      prismaStub.product.findFirst.mockResolvedValue(phoneProduct());

      await expect(
        service.createAdjustment(adjustmentRequest(), SHOP_ID),
      ).rejects.toThrow(BadRequestException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('demands countedQuantity for ADJUSTMENT', async () => {
      await expect(
        service.createAdjustment(
          adjustmentRequest({ countedQuantity: undefined }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects the accessory write-off fields on an ADJUSTMENT', async () => {
      await expect(
        service.createAdjustment(adjustmentRequest({ quantity: 2 }), SHOP_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createAdjustment(
          adjustmentRequest({ inventoryUnitId: UNIT_ID }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('demands quantity for an accessory DAMAGED/LOST', async () => {
      await expect(
        service.createAdjustment(
          writeOffRequest({ quantity: undefined }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects countedQuantity on an accessory DAMAGED/LOST', async () => {
      await expect(
        service.createAdjustment(
          writeOffRequest({ countedQuantity: 9 }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('demands inventoryUnitId for a phone DAMAGED/LOST and rejects accessory fields', async () => {
      prismaStub.product.findFirst.mockResolvedValue(phoneProduct());

      await expect(
        service.createAdjustment(
          writeOffRequest({ inventoryUnitId: undefined, quantity: undefined }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createAdjustment(
          writeOffRequest({ inventoryUnitId: UNIT_ID, quantity: 2 }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses RESTORE on a QUANTITY product', async () => {
      prismaStub.product.findFirst.mockResolvedValue(quantityProduct());

      await expect(
        service.createAdjustment(restoreRequest(), SHOP_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('demands inventoryUnitId for RESTORE and rejects accessory fields', async () => {
      prismaStub.product.findFirst.mockResolvedValue(phoneProduct());

      await expect(
        service.createAdjustment(
          restoreRequest({ inventoryUnitId: undefined }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createAdjustment(restoreRequest({ quantity: 2 }), SHOP_ID),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createAdjustment(
          restoreRequest({ countedQuantity: 5 }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createAdjustment — accessory ADJUSTMENT', () => {
    it('locks the stock row FOR UPDATE, writes the delta as a movement', async () => {
      const res = await service.createAdjustment(
        adjustmentRequest({ countedQuantity: 13 }), // current 10 → +3
        SHOP_ID,
      );

      expect(res).toEqual({
        kind: 'created',
        message: 'Stock change recorded successfully',
      });
      expect(
        String((tx.$queryRaw.mock.calls[0][0] as string[]).join('')).replace(
          /\s+/g,
          ' ',
        ),
      ).toContain('SELECT quantity_on_hand FROM stock_levels');
      expect(
        String((tx.$queryRaw.mock.calls[0][0] as string[]).join('')),
      ).toContain('FOR UPDATE');
      const updateStockCall = tx.$queryRaw.mock.calls.find((c) => {
        const sql = (c[0] as string[]).join('');
        return (
          sql.includes('UPDATE stock_levels') &&
          sql.includes('RETURNING product_id')
        );
      });
      expect(updateStockCall).toBeDefined();
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: SHOP_ID,
          productId: PRODUCT_ID,
          type: 'ADJUSTMENT',
          quantityChange: 3,
          reason: 'Counting difference',
        }),
      });
    });

    it('returns nochange (200, writes nothing) when the count already matches', async () => {
      const res = await service.createAdjustment(
        adjustmentRequest({ countedQuantity: 10 }), // current 10 → delta 0
        SHOP_ID,
      );

      expect(res).toEqual({
        kind: 'nochange',
        message: 'Counted matches the system — no change recorded',
      });
      expect(tx.stockLevel.update).not.toHaveBeenCalled();
      expect(tx.stockLevel.create).not.toHaveBeenCalled();
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('creates the stock level row when one does not exist yet', async () => {
      tx.$queryRaw.mockResolvedValue([]); // no stock_levels row yet

      const res = await service.createAdjustment(
        adjustmentRequest({ countedQuantity: 5 }),
        SHOP_ID,
      );

      expect(res.kind).toBe('created');
      expect(tx.stockLevel.create).toHaveBeenCalledWith({
        data: {
          productId: PRODUCT_ID,
          shopId: SHOP_ID,
          quantityOnHand: 5,
          avgUnitCost: 0n,
        },
      });
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ quantityChange: 5 }),
      });
    });

    it('supports counting down to an empty shelf (countedQuantity = 0)', async () => {
      const res = await service.createAdjustment(
        adjustmentRequest({ countedQuantity: 0 }), // current 10 → −10
        SHOP_ID,
      );

      expect(res.kind).toBe('created');
      const updateStockCall = tx.$queryRaw.mock.calls.find((c) => {
        const sql = (c[0] as string[]).join('');
        return (
          sql.includes('UPDATE stock_levels') &&
          sql.includes('RETURNING product_id')
        );
      });
      expect(updateStockCall).toBeDefined();
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ quantityChange: -10 }),
      });
    });
  });

  describe('createAdjustment — accessory DAMAGED / LOST', () => {
    it('subtracts atomically and appends a movement with the write-off type', async () => {
      const res = await service.createAdjustment(
        writeOffRequest({ type: 'LOST', quantity: 2 }),
        SHOP_ID,
      );

      expect(res).toEqual({
        kind: 'created',
        message: 'Stock change recorded successfully',
      });
      expect(
        String((tx.$executeRaw.mock.calls[0][0] as string[]).join(' ')).replace(
          /\s+/g,
          ' ',
        ),
      ).toContain(
        'UPDATE stock_levels SET quantity_on_hand = quantity_on_hand -',
      );
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'LOST',
          quantityChange: -2,
          reason: 'Broken in the box',
        }),
      });
    });

    it('refuses when the atomic update removes nothing (insufficient stock)', async () => {
      tx.$executeRaw.mockResolvedValue(0); // quantity_on_hand < requested

      await expect(
        service.createAdjustment(writeOffRequest(), SHOP_ID),
      ).rejects.toThrow(BadRequestException);
      expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('createAdjustment — phone DAMAGED / LOST', () => {
    beforeEach(() => {
      prismaStub.product.findFirst.mockResolvedValue(phoneProduct());
    });

    it("flips the unit's status and writes a −1 movement with the reason", async () => {
      tx.$queryRaw.mockResolvedValue([
        { id: UNIT_ID, status: 'IN_STOCK', imei1: '1112233344455' },
      ]);

      const res = await service.createAdjustment(
        writeOffRequest({ quantity: undefined, inventoryUnitId: UNIT_ID }),
        SHOP_ID,
      );

      expect(res.kind).toBe('created');
      expect(
        String((tx.$queryRaw.mock.calls[0][0] as string[]).join('')).replace(
          /\s+/g,
          ' ',
        ),
      ).toContain('SELECT id, status, imei1 FROM inventory_units');
      expect(
        String((tx.$queryRaw.mock.calls[0][0] as string[]).join('')),
      ).toContain('FOR UPDATE');
      const updateUnitCall = tx.$queryRaw.mock.calls.find((c) => {
        const sql = (c[0] as string[]).join('');
        return (
          sql.includes('UPDATE inventory_units') && sql.includes('RETURNING id')
        );
      });
      expect(updateUnitCall).toBeDefined();
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: UNIT_ID,
          type: 'DAMAGED',
          quantityChange: -1,
          reason: 'Broken in the box',
        }),
      });
    });

    it('404s when the unit is not a phone of this shop and this product', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(
        service.createAdjustment(
          writeOffRequest({ quantity: undefined, inventoryUnitId: UNIT_ID }),
          SHOP_ID,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(tx.inventoryUnit.update).not.toHaveBeenCalled();
    });

    it('refuses a unit that is no longer IN_STOCK', async () => {
      tx.$queryRaw.mockResolvedValue([
        { id: UNIT_ID, status: 'SOLD', imei1: '1112233344555' },
      ]);

      await expect(
        service.createAdjustment(
          writeOffRequest({ quantity: undefined, inventoryUnitId: UNIT_ID }),
          SHOP_ID,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(tx.inventoryUnit.update).not.toHaveBeenCalled();
    });
  });

  describe('createAdjustment — phone RESTORE', () => {
    beforeEach(() => {
      prismaStub.product.findFirst.mockResolvedValue(phoneProduct());
      tx.$queryRaw.mockResolvedValue([
        {
          id: UNIT_ID,
          status: 'DAMAGED',
          imei1: '1112233344555',
          imei2: null,
        },
      ]);
    });

    it('flips status to IN_STOCK, creates +1 movement, and invalidates storefront', async () => {
      const outcome = await service.createAdjustment(restoreRequest(), SHOP_ID);

      expect(outcome).toEqual({
        kind: 'created',
        message: 'Stock change recorded successfully',
      });
      const updateUnitCall = tx.$queryRaw.mock.calls.find((c) => {
        const sql = (c[0] as string[]).join('');
        return (
          sql.includes('UPDATE inventory_units') &&
          sql.includes("status = 'IN_STOCK'")
        );
      });
      expect(updateUnitCall).toBeDefined();
      expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inventoryUnitId: UNIT_ID,
          type: 'ADJUSTMENT',
          quantityChange: 1,
          reason: 'Repaired and restored to stock',
          referenceType: 'MANUAL',
          referenceId: UNIT_ID,
        }),
      });
      expect(storefrontRevalidateStub.invalidateShopById).toHaveBeenCalledWith(
        SHOP_ID,
      );
    });

    it('allows restoring a LOST phone', async () => {
      tx.$queryRaw.mockResolvedValue([
        {
          id: UNIT_ID,
          status: 'LOST',
          imei1: '1112233344555',
          imei2: null,
        },
      ]);

      const outcome = await service.createAdjustment(restoreRequest(), SHOP_ID);
      expect(outcome.kind).toBe('created');
    });

    it('404s when the unit is not found for this product and shop', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(
        service.createAdjustment(restoreRequest(), SHOP_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses to restore when unit status is not DAMAGED or LOST (e.g. IN_STOCK)', async () => {
      tx.$queryRaw.mockResolvedValue([
        {
          id: UNIT_ID,
          status: 'IN_STOCK',
          imei1: '1112233344555',
          imei2: null,
        },
      ]);

      await expect(
        service.createAdjustment(restoreRequest(), SHOP_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to restore when another active unit with the same IMEI is already IN_STOCK', async () => {
      tx.inventoryUnit.findFirst.mockResolvedValue({
        id: 'unit-other',
        imei1: '1112233344555',
      });

      await expect(
        service.createAdjustment(restoreRequest(), SHOP_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUnit', () => {
    const baseUnitRow = {
      id: UNIT_ID,
      shopId: SHOP_ID,
      productId: PRODUCT_ID,
      imei1: '1112233344555',
      imei2: null,
      condition: 'NEW',
      status: 'IN_STOCK',
      unitCost: 5000000n,
      batteryHealth: 100,
      askingPrice: 6000000n,
      defectNotes: null,
      createdAt: new Date(),
      product: {
        id: PRODUCT_ID,
        name: 'iPhone 13',
        defaultSellingPrice: 5500000n,
        brand: { name: 'Apple' },
      },
      purchaseItem: null,
      saleItems: [],
    };

    it('successfully updates metadata for Apple unit and invalidates storefront', async () => {
      prismaStub.inventoryUnit.findFirst.mockResolvedValue(baseUnitRow);
      prismaStub.inventoryUnit.update.mockResolvedValue({
        ...baseUnitRow,
        askingPrice: 7000000n,
        defectNotes: 'Minor scratch',
        condition: 'USED',
        batteryHealth: 95,
      });

      const res = await service.updateUnit(
        UNIT_ID,
        {
          askingPrice: 7000000,
          defectNotes: 'Minor scratch',
          condition: 'USED',
          batteryHealth: 95,
        },
        SHOP_ID,
      );

      expect(prismaStub.inventoryUnit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UNIT_ID },
          data: {
            askingPrice: 7000000n,
            defectNotes: 'Minor scratch',
            condition: 'USED',
            batteryHealth: 95,
          },
        }),
      );
      expect(res.askingPrice).toBe(7000000);
      expect(res.defectNotes).toBe('Minor scratch');
      expect(res.condition).toBe('USED');
      expect(res.batteryHealth).toBe(95);
      expect(storefrontRevalidateStub.invalidateShopById).toHaveBeenCalledWith(
        SHOP_ID,
      );
    });

    it('refuses batteryHealth when product brand is not Apple', async () => {
      prismaStub.inventoryUnit.findFirst.mockResolvedValue({
        ...baseUnitRow,
        product: {
          id: PRODUCT_ID,
          name: 'Galaxy S21',
          defaultSellingPrice: 5000000n,
          brand: { name: 'Samsung' },
        },
      });

      await expect(
        service.updateUnit(UNIT_ID, { batteryHealth: 90 }, SHOP_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses editing when unit status is SOLD or VOIDED', async () => {
      prismaStub.inventoryUnit.findFirst.mockResolvedValue({
        ...baseUnitRow,
        status: 'SOLD',
      });

      await expect(
        service.updateUnit(UNIT_ID, { askingPrice: 6000000 }, SHOP_ID),
      ).rejects.toThrow(BadRequestException);

      prismaStub.inventoryUnit.findFirst.mockResolvedValue({
        ...baseUnitRow,
        status: 'VOIDED',
      });

      await expect(
        service.updateUnit(UNIT_ID, { askingPrice: 6000000 }, SHOP_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('404s when unit does not belong to shop', async () => {
      prismaStub.inventoryUnit.findFirst.mockResolvedValue(null);

      await expect(
        service.updateUnit(UNIT_ID, { askingPrice: 6000000 }, SHOP_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInventoryMovements', () => {
    const row = {
      id: 'm-1',
      shopId: SHOP_ID,
      productId: PRODUCT_ID,
      inventoryUnitId: null,
      type: 'ADJUSTMENT',
      quantityChange: 3,
      reason: 'Counting difference',
      referenceType: null,
      referenceId: null,
      createdAt: new Date('2026-10-07T10:00:00Z'),
      product: { name: 'USB Cable' },
      inventoryUnit: null,
    };

    beforeEach(() => {
      prismaStub.inventoryMovement.findMany.mockResolvedValue([row]);
      prismaStub.inventoryMovement.count.mockResolvedValue(1);
    });

    it('defaults to manual movement types only, shop-scoped and paginated', async () => {
      const res = await service.getInventoryMovements({}, SHOP_ID);

      expect(prismaStub.inventoryMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId: SHOP_ID,
            type: { in: ['ADJUSTMENT', 'DAMAGED', 'LOST'] },
          },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(res).toEqual({
        items: [
          {
            id: 'm-1',
            shopId: SHOP_ID,
            productId: PRODUCT_ID,
            productName: 'USB Cable',
            inventoryUnitId: null,
            imei: null,
            type: 'ADJUSTMENT',
            quantityChange: 3,
            reason: 'Counting difference',
            referenceType: null,
            referenceId: null,
            createdAt: row.createdAt,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });
    });

    it('applies type, date range, search and sort filters', async () => {
      await service.getInventoryMovements(
        {
          page: 2,
          pageSize: 25,
          type: 'DAMAGED',
          from: '2026-10-01',
          to: '2026-10-31',
          search: 'cable',
          sortBy: 'quantityChange',
          sortOrder: 'asc',
        } as any,
        SHOP_ID,
      );

      const call = prismaStub.inventoryMovement.findMany.mock.calls[0][0];
      expect(call.where.type).toBe('DAMAGED');
      expect(call.where.AND).toEqual([
        { createdAt: { gte: new Date('2026-09-30T19:00:00.000Z') } },
        { createdAt: { lt: new Date('2026-10-31T19:00:00.000Z') } },
        {
          OR: [
            { product: { name: { contains: 'cable', mode: 'insensitive' } } },
            { reason: { contains: 'cable', mode: 'insensitive' } },
          ],
        },
      ]);
      expect(call.skip).toBe(25);
      expect(call.take).toBe(25);
      expect(call.orderBy).toEqual({ quantityChange: 'asc' });
    });

    it('applies productId, exact quantityChange and reason word match', async () => {
      await service.getInventoryMovements(
        {
          productId: PRODUCT_ID,
          quantityChange: -2,
          reason: 'water screen',
        },
        SHOP_ID,
      );

      const call = prismaStub.inventoryMovement.findMany.mock.calls[0][0];
      expect(call.where.productId).toBe(PRODUCT_ID);
      expect(call.where.quantityChange).toBe(-2);
      expect(call.where.AND).toEqual([
        {
          OR: [
            { reason: { contains: 'water', mode: 'insensitive' } },
            { reason: { contains: 'screen', mode: 'insensitive' } },
          ],
        },
      ]);
    });

    it('scope=all omits the manual-type restriction', async () => {
      await service.getInventoryMovements({ scope: 'all' } as any, SHOP_ID);

      const call = prismaStub.inventoryMovement.findMany.mock.calls[0][0];
      expect(call.where).toEqual({ shopId: SHOP_ID });
    });
  });
});
