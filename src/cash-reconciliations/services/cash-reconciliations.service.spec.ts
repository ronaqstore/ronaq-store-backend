import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CashReconciliationsService } from './cash-reconciliations.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

const SHOP_ID = 'shop-1';
const USER_ID = 'user-1';
const CLIENT_REQUEST_ID = '01924f0a-0000-7000-8000-00000000beef';

const prismaStub = {
  cashMovement: {
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  cashReconciliation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

interface TxStub {
  $queryRaw: jest.Mock;
  cashMovement: {
    create: jest.Mock;
    aggregate: jest.Mock;
  };
  cashReconciliation: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
}

function makeTx(overrides: Partial<TxStub> = {}): TxStub {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: SHOP_ID }]),
    cashMovement: {
      create: jest.fn().mockResolvedValue({ id: 'cm-1' }),
      aggregate: jest.fn(({ where }: { where: { direction?: string } }) =>
        Promise.resolve({
          _sum: {
            amount: where.direction === 'IN' ? 100000000n : 0n,
          },
        }),
      ),
    },
    cashReconciliation: {
      create: jest.fn().mockResolvedValue({ id: 'rec-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    ...overrides,
  };
}

const reconciliationRow = {
  id: 'rec-1',
  shopId: SHOP_ID,
  systemCash: 100000000n,
  countedCash: 100000000n,
  difference: 0n,
  reason: null,
  reconciledAt: new Date('2026-10-08T12:00:00.000Z'),
  createdById: USER_ID,
};

describe('CashReconciliationsService', () => {
  let service: CashReconciliationsService;
  let tx: TxStub;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashReconciliationsService,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile();

    service = module.get<CashReconciliationsService>(
      CashReconciliationsService,
    );

    tx = makeTx();
    prismaStub.$transaction.mockImplementation((cb: (t: unknown) => unknown) =>
      cb(tx),
    );
    prismaStub.cashReconciliation.findFirst.mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReconciliation', () => {
    it('locks the shop, stores a matching count and writes NO movement', async () => {
      const res = await service.createReconciliation(
        { clientRequestId: CLIENT_REQUEST_ID, countedCash: 100000000 },
        SHOP_ID,
        USER_ID,
      );

      expect(res).toEqual({
        status: true,
        message: 'Cash reconciliation recorded successfully',
      });
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.cashReconciliation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            shopId: SHOP_ID,
            systemCash: 100000000n,
            countedCash: 100000000n,
            difference: 0n,
            reason: null,
            clientRequestId: CLIENT_REQUEST_ID,
            createdById: USER_ID,
          },
        }),
      );
      expect(tx.cashMovement.create).not.toHaveBeenCalled();
    });

    it('returns already-saved without writing when clientRequestId exists', async () => {
      prismaStub.cashReconciliation.findFirst.mockResolvedValue({
        id: 'rec-1',
      });

      const res = await service.createReconciliation(
        { clientRequestId: CLIENT_REQUEST_ID, countedCash: 100050000 },
        SHOP_ID,
        USER_ID,
      );

      expect(res).toEqual({
        status: true,
        message: 'Cash reconciliation already saved',
      });
      expect(prismaStub.$transaction).not.toHaveBeenCalled();
      expect(tx.cashReconciliation.create).not.toHaveBeenCalled();
      expect(tx.cashMovement.create).not.toHaveBeenCalled();
    });

    it('writes an IN adjustment when the drawer has more than the system says', async () => {
      await service.createReconciliation(
        {
          clientRequestId: CLIENT_REQUEST_ID,
          countedCash: 100050000,
          reason: 'Found hidden cash',
        },
        SHOP_ID,
        USER_ID,
      );

      expect(tx.cashReconciliation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            systemCash: 100000000n,
            countedCash: 100050000n,
            difference: 50000n,
            reason: 'Found hidden cash',
            clientRequestId: CLIENT_REQUEST_ID,
          }),
        }),
      );
      expect(tx.cashMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: SHOP_ID,
          type: 'RECONCILIATION_ADJUSTMENT',
          direction: 'IN',
          amount: 50000n,
          movementDate: expect.any(Date),
          referenceType: 'RECONCILIATION',
          referenceId: 'rec-1',
          createdById: USER_ID,
        }),
      });
    });

    it('writes an OUT adjustment when the drawer has less than the system says', async () => {
      await service.createReconciliation(
        {
          clientRequestId: CLIENT_REQUEST_ID,
          countedCash: 99900000,
          reason: 'Wrong change given',
        },
        SHOP_ID,
        USER_ID,
      );

      expect(tx.cashReconciliation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            difference: -100000n,
          }),
        }),
      );
      expect(tx.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'RECONCILIATION_ADJUSTMENT',
            direction: 'OUT',
            amount: 100000n,
          }),
        }),
      );
    });

    it('reproduces crash on overdraft: legacy cash_recon_amounts_chk constraint blocks systemCash < 0 (PostgreSQL 23514)', async () => {
      // Overdraft state: Inbound 10,000,000 paisa, Outbound 15,000,000 paisa -> current cash = -5,000,000 paisa
      tx.cashMovement.aggregate = jest.fn(
        ({ where }: { where: { direction?: string } }) =>
          Promise.resolve({
            _sum: {
              amount: where.direction === 'IN' ? 10000000n : 15000000n,
            },
          }),
      ) as any;

      // Legacy PostgreSQL check constraint: CHECK (system_cash >= 0 AND counted_cash >= 0 AND difference = counted_cash - system_cash)
      tx.cashReconciliation.create = jest
        .fn()
        .mockImplementation(({ data }) => {
          if (data.systemCash < 0n) {
            const err = new Error(
              'new row for relation "cash_reconciliations" violates check constraint "cash_recon_amounts_chk"',
            );
            (err as any).code = '23514';
            throw err;
          }
          return Promise.resolve({ id: 'rec-overdraft' });
        });

      // Shop owner reconciles drawer while in overdraft -> crashes with check constraint violation
      await expect(
        service.createReconciliation(
          {
            clientRequestId: CLIENT_REQUEST_ID,
            countedCash: 0,
            reason: 'Closing overdraft drawer',
          },
          SHOP_ID,
          USER_ID,
        ),
      ).rejects.toThrow(
        'new row for relation "cash_reconciliations" violates check constraint "cash_recon_amounts_chk"',
      );
    });

    it('successfully reconciles an overdraft drawer with countedCash = 0 under the new constraint', async () => {
      // Overdraft state: Inbound 10,000,000 paisa, Outbound 15,000,000 paisa -> current cash = -5,000,000 paisa
      tx.cashMovement.aggregate = jest.fn(
        ({ where }: { where: { direction?: string } }) =>
          Promise.resolve({
            _sum: {
              amount: where.direction === 'IN' ? 10000000n : 15000000n,
            },
          }),
      ) as any;

      // New PostgreSQL check constraint: CHECK (counted_cash >= 0 AND difference = counted_cash - system_cash)
      // Allows systemCash < 0, while maintaining countedCash >= 0 and difference equation.
      tx.cashReconciliation.create = jest
        .fn()
        .mockImplementation(({ data }) => {
          if (
            data.countedCash < 0n ||
            data.difference !== data.countedCash - data.systemCash
          ) {
            const err = new Error(
              'new row for relation "cash_reconciliations" violates check constraint "cash_recon_amounts_chk"',
            );
            (err as any).code = '23514';
            throw err;
          }
          return Promise.resolve({ id: 'rec-overdraft' });
        });

      const res = await service.createReconciliation(
        {
          clientRequestId: CLIENT_REQUEST_ID,
          countedCash: 0,
          reason: 'Closing overdraft drawer',
        },
        SHOP_ID,
        USER_ID,
      );

      expect(res).toEqual({
        status: true,
        message: 'Cash reconciliation recorded successfully',
      });
      // System cash is negative BigInt (-5000000n), counted cash is 0n, difference is +5000000n
      expect(tx.cashReconciliation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shopId: SHOP_ID,
            systemCash: -5000000n,
            countedCash: 0n,
            difference: 5000000n,
            reason: 'Closing overdraft drawer',
            clientRequestId: CLIENT_REQUEST_ID,
            createdById: USER_ID,
          }),
        }),
      );
      // Because counted > system (0 > -5000000), an IN adjustment of 5000000n restores the drawer balance to 0
      expect(tx.cashMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: SHOP_ID,
          type: 'RECONCILIATION_ADJUSTMENT',
          direction: 'IN',
          amount: 5000000n,
          movementDate: expect.any(Date),
          referenceType: 'RECONCILIATION',
          referenceId: 'rec-overdraft',
          createdById: USER_ID,
        }),
      });
    });

    it('successfully reconciles an overdraft drawer with positive countedCash', async () => {
      // Overdraft state: current cash = -5,000,000 paisa
      tx.cashMovement.aggregate = jest.fn(
        ({ where }: { where: { direction?: string } }) =>
          Promise.resolve({
            _sum: {
              amount: where.direction === 'IN' ? 10000000n : 15000000n,
            },
          }),
      ) as any;

      tx.cashReconciliation.create = jest
        .fn()
        .mockImplementation(({ data }) => {
          if (
            data.countedCash < 0n ||
            data.difference !== data.countedCash - data.systemCash
          ) {
            const err = new Error(
              'new row for relation "cash_reconciliations" violates check constraint "cash_recon_amounts_chk"',
            );
            (err as any).code = '23514';
            throw err;
          }
          return Promise.resolve({ id: 'rec-overdraft-positive' });
        });

      // Drawer has Rs 20,000 (2,000,000 paisa) physically counted in hand
      const res = await service.createReconciliation(
        {
          clientRequestId: CLIENT_REQUEST_ID,
          countedCash: 2000000,
          reason: 'Owner deposited funds into overdraft drawer',
        },
        SHOP_ID,
        USER_ID,
      );

      expect(res.status).toBe(true);
      // difference = 2000000 - (-5000000) = 7000000n
      expect(tx.cashReconciliation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            systemCash: -5000000n,
            countedCash: 2000000n,
            difference: 7000000n,
          }),
        }),
      );
      // IN adjustment of 7000000 brings balance from -5,000,000 to +2,000,000
      expect(tx.cashMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'IN',
            amount: 7000000n,
          }),
        }),
      );
    });

    it('returns already-saved when clientRequestId is detected inside the transaction lock (Law 4 in-lock check)', async () => {
      tx.cashReconciliation.findFirst.mockResolvedValue({ id: 'rec-already' });

      const res = await service.createReconciliation(
        { clientRequestId: CLIENT_REQUEST_ID, countedCash: 100000000 },
        SHOP_ID,
        USER_ID,
      );

      expect(res).toEqual({
        status: true,
        message: 'Cash reconciliation already saved',
      });
      expect(tx.cashReconciliation.create).not.toHaveBeenCalled();
      expect(tx.cashMovement.create).not.toHaveBeenCalled();
    });

    it('returns already-saved on racing unique constraint violation on client_request_id (Law 4 concurrent race)', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the constraint: cash_reconciliations_shop_id_client_request_id_key',
        {
          code: 'P2002',
          clientVersion: '7.10.0',
          meta: {
            target: ['cash_reconciliations_shop_id_client_request_id_key'],
          },
        },
      );
      tx.cashReconciliation.create.mockRejectedValue(error);

      const res = await service.createReconciliation(
        { clientRequestId: CLIENT_REQUEST_ID, countedCash: 100000000 },
        SHOP_ID,
        USER_ID,
      );

      expect(res).toEqual({
        status: true,
        message: 'Cash reconciliation already saved',
      });
    });

    it('enforces the new constraint: counted_cash cannot be negative', async () => {
      // Simulate new constraint blocking countedCash < 0n
      tx.cashReconciliation.create = jest
        .fn()
        .mockImplementation(({ data }) => {
          if (
            data.countedCash < 0n ||
            data.difference !== data.countedCash - data.systemCash
          ) {
            const err = new Error(
              'new row for relation "cash_reconciliations" violates check constraint "cash_recon_amounts_chk"',
            );
            (err as any).code = '23514';
            throw err;
          }
          return Promise.resolve({ id: 'rec-1' });
        });

      await expect(
        service.createReconciliation(
          {
            clientRequestId: CLIENT_REQUEST_ID,
            countedCash: -100 as any,
            reason: 'Negative test',
          },
          SHOP_ID,
          USER_ID,
        ),
      ).rejects.toThrow('violates check constraint "cash_recon_amounts_chk"');
    });

    it('rejects a non-zero difference without a reason', async () => {
      const err = await service
        .createReconciliation(
          { clientRequestId: CLIENT_REQUEST_ID, countedCash: 100050000 },
          SHOP_ID,
          USER_ID,
        )
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({
        error: 'Reason required for the difference',
      });
      expect(tx.cashReconciliation.create).not.toHaveBeenCalled();
      expect(tx.cashMovement.create).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only reason the same way', async () => {
      const err = await service
        .createReconciliation(
          {
            clientRequestId: CLIENT_REQUEST_ID,
            countedCash: 100050000,
            reason: '   ',
          },
          SHOP_ID,
          USER_ID,
        )
        .catch((e) => e);

      expect(err).toBeInstanceOf(BadRequestException);
      expect(tx.cashReconciliation.create).not.toHaveBeenCalled();
    });

    it('404s when the shop row does not exist and writes nothing', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(
        service.createReconciliation(
          { clientRequestId: CLIENT_REQUEST_ID, countedCash: 100000000 },
          SHOP_ID,
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tx.cashReconciliation.create).not.toHaveBeenCalled();
      expect(tx.cashMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('getReconciliations', () => {
    it('scopes to the shop, maps rows and honours search/sort', async () => {
      prismaStub.cashReconciliation.findMany.mockResolvedValue([
        reconciliationRow,
      ]);
      prismaStub.cashReconciliation.count.mockResolvedValue(1);

      const res = await service.getReconciliations(
        { search: 'change', sortBy: 'difference', sortOrder: 'asc' } as any,
        SHOP_ID,
      );

      expect(prismaStub.cashReconciliation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId: SHOP_ID,
            AND: [
              {
                OR: [{ reason: { contains: 'change', mode: 'insensitive' } }],
              },
            ],
          },
          orderBy: { difference: 'asc' },
        }),
      );
      expect(res.items[0]).toEqual({
        id: 'rec-1',
        shopId: SHOP_ID,
        systemCash: 100000000,
        countedCash: 100000000,
        difference: 0,
        reason: null,
        reconciledAt: reconciliationRow.reconciledAt,
        createdById: USER_ID,
      });
    });

    it('turns from/to into business-day bounds on reconciledAt', async () => {
      await service.getReconciliations(
        { from: '2026-10-01', to: '2026-10-31' },
        SHOP_ID,
      );

      expect(prismaStub.cashReconciliation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shopId: SHOP_ID,
            AND: [
              { reconciledAt: { gte: expect.any(Date) } },
              { reconciledAt: { lt: expect.any(Date) } },
            ],
          },
        }),
      );
    });
  });

  describe('getReconciliationById', () => {
    it('404s when the row is missing or belongs to another shop', async () => {
      await expect(
        service.getReconciliationById('missing', SHOP_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the mapped row when found', async () => {
      prismaStub.cashReconciliation.findFirst.mockResolvedValue(
        reconciliationRow,
      );

      const res = await service.getReconciliationById('rec-1', SHOP_ID);

      expect(prismaStub.cashReconciliation.findFirst).toHaveBeenCalledWith({
        where: { id: 'rec-1', shopId: SHOP_ID },
      });
      expect(res.difference).toBe(0);
    });
  });
});
