import { BadRequestException } from '@nestjs/common';
import {
  findConflictingInStockUnit,
  assertImeiNotInStock,
} from './inventory-imei.helper.js';

describe('inventory-imei.helper', () => {
  const SHOP_ID = '01924f0a-0000-7000-8000-000000000001';
  const UNIT_ID = '01924f0a-0000-7000-8000-000000000010';
  const OTHER_ID = '01924f0a-0000-7000-8000-000000000020';
  const IMEI1 = '352000000000001';
  const IMEI2 = '352000000000002';

  let dbMock: any;

  beforeEach(() => {
    dbMock = {
      inventoryUnit: {
        findFirst: jest.fn(),
      },
    };
  });

  describe('findConflictingInStockUnit', () => {
    it('returns null when no IN_STOCK unit has the IMEI', async () => {
      dbMock.inventoryUnit.findFirst.mockResolvedValue(null);

      const res = await findConflictingInStockUnit(
        dbMock,
        SHOP_ID,
        UNIT_ID,
        IMEI1,
        IMEI2,
      );

      expect(res).toBeNull();
      expect(dbMock.inventoryUnit.findFirst).toHaveBeenCalledWith({
        where: {
          shopId: SHOP_ID,
          id: { not: UNIT_ID },
          status: 'IN_STOCK',
          OR: [
            { imei1: IMEI1 },
            { imei2: IMEI1 },
            { imei1: IMEI2 },
            { imei2: IMEI2 },
          ],
        },
        select: { id: true, imei1: true, imei2: true },
      });
    });

    it('returns the conflicting unit if found', async () => {
      const hit = { id: OTHER_ID, imei1: IMEI1, imei2: null };
      dbMock.inventoryUnit.findFirst.mockResolvedValue(hit);

      const res = await findConflictingInStockUnit(
        dbMock,
        SHOP_ID,
        UNIT_ID,
        IMEI1,
      );

      expect(res).toBe(hit);
    });
  });

  describe('assertImeiNotInStock', () => {
    it('passes cleanly when no conflicting unit is in stock', async () => {
      dbMock.inventoryUnit.findFirst.mockResolvedValue(null);

      await expect(
        assertImeiNotInStock(dbMock, SHOP_ID, UNIT_ID, IMEI1, IMEI2),
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException with duplicateImei by default', async () => {
      dbMock.inventoryUnit.findFirst.mockResolvedValue({
        id: OTHER_ID,
        imei1: IMEI1,
        imei2: null,
      });

      await expect(
        assertImeiNotInStock(dbMock, SHOP_ID, UNIT_ID, IMEI1),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses custom errorFactory when provided', async () => {
      dbMock.inventoryUnit.findFirst.mockResolvedValue({
        id: OTHER_ID,
        imei1: IMEI1,
        imei2: null,
      });

      const customError = new BadRequestException('Custom message');
      const errorFactory = jest.fn().mockReturnValue(customError);

      await expect(
        assertImeiNotInStock(
          dbMock,
          SHOP_ID,
          UNIT_ID,
          IMEI1,
          null,
          errorFactory,
        ),
      ).rejects.toBe(customError);

      expect(errorFactory).toHaveBeenCalledWith(IMEI1);
    });
  });
});
