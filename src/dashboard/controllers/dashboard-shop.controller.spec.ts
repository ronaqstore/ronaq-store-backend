import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../generated/prisma/enums.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';
import { DashboardShopController } from './dashboard-shop.controller.js';
import { DashboardShopService } from '../services/dashboard-shop.service.js';
import { DashboardReceivablesService } from '../services/dashboard-receivables.service.js';
import { DashboardProductsService } from '../services/dashboard-products.service.js';
import { DashboardInventoryService } from '../services/dashboard-inventory.service.js';
import { ShopDashboardQueryDto } from '../dto/shop/shop-dashboard-query.dto.js';

function ownerReq(shopId: string, role: UserRole | string): OwnerRequest {
  return {
    user: {
      userId: 'user-1',
      shopId,
      role: role as UserRole,
    },
  } as OwnerRequest;
}

describe('DashboardShopController', () => {
  let controller: DashboardShopController;

  const shopServiceMock = {
    getKpis: jest.fn(),
    getSalesTrend: jest.fn(),
    getProfitWaterfall: jest.fn(),
    getCashFlow: jest.fn(),
  };
  const receivablesMock = { getReceivablesAging: jest.fn() };
  const productsMock = {
    getTopProducts: jest.fn(),
    getSalesMix: jest.fn(),
  };
  const inventoryMock = {
    getExpensesByCategory: jest.fn(),
    getInventoryAging: jest.fn(),
    getAttention: jest.fn(),
  };

  const query7d = Object.assign(new ShopDashboardQueryDto(), {
    period: '7d',
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardShopController],
      providers: [
        { provide: DashboardShopService, useValue: shopServiceMock },
        {
          provide: DashboardReceivablesService,
          useValue: receivablesMock,
        },
        { provide: DashboardProductsService, useValue: productsMock },
        { provide: DashboardInventoryService, useValue: inventoryMock },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DashboardShopController);
  });

  it('scopes KPIs to JWT shopId and never a query shopId', async () => {
    shopServiceMock.getKpis.mockResolvedValue({ totals: {} });
    await controller.getKpis(
      query7d,
      ownerReq('shop-from-jwt', UserRole.OWNER),
    );
    expect(shopServiceMock.getKpis).toHaveBeenCalledWith(
      'shop-from-jwt',
      expect.anything(),
    );
  });

  it('forbids non-owner roles from profit/cost KPIs', async () => {
    await expect(
      controller.getKpis(query7d, ownerReq('shop-a', 'STAFF')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(shopServiceMock.getKpis).not.toHaveBeenCalled();
  });

  it('forbids non-owners from waterfall (cost data)', async () => {
    await expect(
      controller.getProfitWaterfall(query7d, ownerReq('shop-a', 'STAFF')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
