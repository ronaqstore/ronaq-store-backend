import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from '../services/inventory.service.js';
import { InventoryAdjustmentService } from '../services/inventory-adjustment.service.js';
import { ImeiLookupService } from '../services/imei-lookup.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';
import { BadRequestException } from '@nestjs/common';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';
import { storefrontRevalidateStub } from '../../../test/stubs/storefront-revalidate.stub.js';

const prismaStub = { $transaction: jest.fn() };

function mockRes() {
  const status = jest.fn().mockReturnThis();
  return { status, json: jest.fn() } as any;
}

describe('InventoryController', () => {
  let controller: InventoryController;
  let inventoryService: InventoryService;
  let imeiLookupService: ImeiLookupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        InventoryAdjustmentService,
        ImeiLookupService,
        { provide: PrismaService, useValue: prismaStub },
        {
          provide: StorefrontRevalidateService,
          useValue: storefrontRevalidateStub,
        },
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
          useValue: {
            get: jest.fn().mockReturnValue({ jwtSecret: 'test-secret' }),
            auth: { jwtSecret: 'test-secret' },
          },
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    inventoryService = module.get<InventoryService>(InventoryService);
    imeiLookupService = module.get<ImeiLookupService>(ImeiLookupService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns 201 when a row was actually written', async () => {
    jest.spyOn(inventoryService, 'createAdjustment').mockResolvedValue({
      kind: 'created',
      message: 'Stock change recorded successfully',
    });
    const res = mockRes();

    const body = await controller.createAdjustment(
      {} as any,
      {
        user: { shopId: 'shop-1' },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(body).toEqual({
      message: 'Stock change recorded successfully',
      data: {
        kind: 'created',
        message: 'Stock change recorded successfully',
      },
    });
  });

  it('returns 200 (nothing written) when the count already matched', async () => {
    jest.spyOn(inventoryService, 'createAdjustment').mockResolvedValue({
      kind: 'nochange',
      message: 'Counted matches the system — no change recorded',
    });
    const res = mockRes();

    await controller.createAdjustment(
      {} as any,
      {
        user: { shopId: 'shop-1' },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('preserves a service 400 (shape rule) response', async () => {
    jest
      .spyOn(inventoryService, 'createAdjustment')
      .mockRejectedValue(new BadRequestException('bad adjustment'));

    await expect(
      controller.createAdjustment(
        {} as any,
        {
          user: { shopId: 'shop-1' },
        },
        mockRes(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 500 for an unexpected service error', async () => {
    jest
      .spyOn(inventoryService, 'createAdjustment')
      .mockRejectedValue(new Error('database unavailable'));

    await expect(
      controller.createAdjustment(
        {} as any,
        {
          user: { shopId: 'shop-1' },
        },
        mockRes(),
      ),
    ).rejects.toThrow('Failed to record inventory adjustment');
  });

  it('updates unit metadata via updateUnit', async () => {
    const mockUnit = {
      id: '01924f0a-0000-7000-8000-000000000001',
      productId: '01924f0a-0000-7000-8000-000000000101',
      imei1: '123456789012345',
      imei2: null,
      condition: 'NEW' as const,
      status: 'IN_STOCK' as const,
      unitCost: 5000000,
      batteryHealth: 99,
      askingPrice: 5500000,
      defectNotes: null,
      effectivePrice: 5500000,
      createdAt: new Date(),
    };
    jest.spyOn(inventoryService, 'updateUnit').mockResolvedValue(mockUnit);

    const body = await controller.updateUnit(
      '01924f0a-0000-7000-8000-000000000001',
      { askingPrice: 5500000 },
      { user: { shopId: 'shop-1' } } as any,
    );

    expect(body).toEqual({
      message: 'Inventory unit updated successfully',
      data: mockUnit,
    });
  });

  describe('lookupImei', () => {
    it('returns lookup result wrapped in ApiSuccessResponseDTO', async () => {
      const mockResult: any = {
        found: true,
        device: { imei1: '354892091234567' },
        salesHistory: [],
        timeline: [],
      };
      jest.spyOn(imeiLookupService, 'lookupImei').mockResolvedValue(mockResult);

      const body = await controller.lookupImei({ imei: '354892091234567' }, {
        user: { shopId: 'shop-1' },
      } as any);

      expect(body).toEqual({
        message: 'IMEI lookup retrieved successfully',
        data: mockResult,
      });
    });

    it('propagates HttpException when thrown', async () => {
      jest
        .spyOn(imeiLookupService, 'lookupImei')
        .mockRejectedValue(new BadRequestException('Invalid query'));

      await expect(
        controller.lookupImei({ imei: '' }, {
          user: { shopId: 'shop-1' },
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 500 for unexpected error', async () => {
      jest
        .spyOn(imeiLookupService, 'lookupImei')
        .mockRejectedValue(new Error('crash'));

      await expect(
        controller.lookupImei({ imei: '354892091234567' }, {
          user: { shopId: 'shop-1' },
        } as any),
      ).rejects.toThrow('Failed to lookup IMEI');
    });
  });
});
