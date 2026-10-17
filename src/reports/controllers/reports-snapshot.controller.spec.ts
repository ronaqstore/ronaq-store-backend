import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ReportsSnapshotController } from './reports-snapshot.controller.js';
import { ReportsService } from '../services/reports.service.js';
import { ReportsLedgerService } from '../services/reports-ledger.service.js';
import { ReportsAnalyticsService } from '../services/reports-analytics.service.js';
import { ReportsQueryHelper } from '../services/reports-query.helper.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';

const prismaStub = {};

const pageStub = {
  page: 1,
  pageSize: 10,
  total: 0,
  from: '2026-10-01',
  to: '2026-10-31',
  summary: { count: 0 },
  items: [],
};

const req = { user: { shopId: 'shop-1', userId: 'user-1' } } as any;

describe('ReportsSnapshotController', () => {
  let controller: ReportsSnapshotController;
  let reportsService: ReportsService;

  const headers: Record<string, string> = {};
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(headers).forEach((k) => delete headers[k]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsSnapshotController],
      providers: [
        ReportsService,
        ReportsLedgerService,
        ReportsAnalyticsService,
        ReportsQueryHelper,
        { provide: PrismaService, useValue: prismaStub },
        {
          provide: AuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn(), sign: jest.fn() },
        },
        {
          provide: AppConfigurationService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<ReportsSnapshotController>(
      ReportsSnapshotController,
    );
    reportsService = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it.each([
    ['customerReport', 'customers', 'getCustomerReport'],
    ['supplierReport', 'suppliers', 'getSupplierReport'],
    ['inventoryReport', 'inventory', 'getInventoryReport'],
    ['bestSellersReport', 'best-sellers', 'getBestSellersReport'],
  ] as const)(
    '%s scopes to the JWT shop and wraps JSON in the envelope',
    async (method, _name, serviceMethod) => {
      const spy = jest
        .spyOn(reportsService, serviceMethod)
        .mockResolvedValue(pageStub as any);

      const out = await (controller as any)[method](
        { period: 'today' },
        req,
        res,
      );

      expect(spy).toHaveBeenCalledWith(expect.anything(), 'shop-1');
      expect(out.message).toBeDefined();
      expect(out.data).toEqual(pageStub);
      expect(headers['Content-Type']).toBeUndefined();
    },
  );

  it.each([
    [
      'customerReport',
      'customers',
      'getCustomerReport',
      'customers-2026-10-01-to-2026-10-31.csv',
    ],
  ] as const)(
    '%s returns a text/csv download when format=csv',
    async (method, _name, serviceMethod, filename) => {
      jest
        .spyOn(reportsService, serviceMethod)
        .mockResolvedValue(pageStub as any);

      const out = await (controller as any)[method](
        { period: 'today', format: 'csv' },
        req,
        res,
      );

      expect(headers['Content-Type']).toContain('text/csv');
      expect(headers['Content-Disposition']).toContain(filename);
      expect(typeof out).toBe('string');
      expect(out).not.toHaveProperty('message');
    },
  );
});
