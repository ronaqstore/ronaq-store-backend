import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConsignmentsService } from './consignments.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ConsignmentStatus,
  PaymentMethod,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { CreateConsignmentDto } from '../dto/create-consignment.dto.js';
import { ReturnConsignmentDto } from '../dto/return-consignment.dto.js';
import { SettleConsignmentDto } from '../dto/settle-consignment.dto.js';
import { CancelConsignmentDto } from '../dto/cancel-consignment.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';

const SHOP_ID = '01924f0a-0000-7000-8000-000000000001';
const USER_ID = '01924f0a-0000-7000-8000-000000000002';
const PRODUCT_ID = '01924f0a-0000-7000-8000-000000000003';
const CONSIGNMENT_ID = '01924f0a-0000-7000-8000-000000000005';

const prismaStub = {
  consignment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
  },
  inventoryUnit: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  inventoryMovement: {
    create: jest.fn(),
  },
  cashMovement: {
    aggregate: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

interface TxStub {
  $queryRaw: jest.Mock;
  consignment: {
    create: jest.Mock;
    update: jest.Mock;
  };
  inventoryUnit: {
    create: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  inventoryMovement: {
    create: jest.Mock;
  };
  cashMovement: {
    aggregate: jest.Mock;
    create: jest.Mock;
  };
}

function makeTx(overrides: Partial<TxStub> = {}): TxStub {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ next: 1 }]),
    consignment: {
      create: jest
        .fn()
        .mockResolvedValue({ id: CONSIGNMENT_ID, consignmentNo: 'CON-0001' }),
      update: jest.fn().mockResolvedValue({ id: CONSIGNMENT_ID }),
    },
    inventoryUnit: {
      create: jest.fn().mockResolvedValue({ id: 'unit-1' }),
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'unit-1', status: UnitStatus.IN_STOCK }),
      update: jest.fn().mockResolvedValue({ id: 'unit-1' }),
    },
    inventoryMovement: {
      create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
    },
    cashMovement: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 10000000n } }),
      create: jest.fn().mockResolvedValue({ id: 'cash-1' }),
    },
    ...overrides,
  };
}

function makeMockConsignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONSIGNMENT_ID,
    consignmentNo: 'CON-0001',
    shopId: SHOP_ID,
    customerId: null,
    consignorName: 'Muhammad Ali',
    consignorPhone: '03001234567',
    consignorCnic: '17301-1234567-1',
    productId: PRODUCT_ID,
    imei1: '356938035643803',
    imei2: '356938035643804',
    condition: 'USED',
    batteryHealth: 88,
    defectNotes: null,
    agreedPayout: 5000000n,
    targetSellingPrice: 5500000n,
    status: ConsignmentStatus.IN_CUSTODY,
    intakeDate: new Date('2026-11-01T00:00:00Z'),
    inventoryUnits: [
      { id: 'unit-1', status: 'IN_STOCK', askingPrice: 5500000n },
    ],
    product: {
      id: PRODUCT_ID,
      name: 'iPhone 13',
      brand: { name: 'Apple' },
      trackingType: 'SERIALIZED',
    },
    customer: null,
    saleItem: null,
    soldAt: null,
    soldPrice: null,
    settledAt: null,
    settledAmount: null,
    payoutMethod: null,
    payoutReference: null,
    returnedAt: null,
    returnReason: null,
    cancelledAt: null,
    cancelReason: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ConsignmentsService', () => {
  let service: ConsignmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsignmentsService,
        { provide: PrismaService, useValue: prismaStub },
      ],
    }).compile();

    service = module.get<ConsignmentsService>(ConsignmentsService);
  });

  describe('1. Happy Path Execution', () => {
    it('creates a new consignment agreement and places unit in stock', async () => {
      prismaStub.consignment.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeMockConsignmentRow());
      prismaStub.product.findFirst.mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'iPhone 13',
        trackingType: 'SERIALIZED',
        brand: { name: 'Apple' },
      });
      prismaStub.inventoryUnit.findFirst.mockResolvedValueOnce(null);

      const tx = makeTx();
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000010',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        consignorCnic: '17301-1234567-1',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        imei2: '356938035643804',
        condition: 'USED',
        batteryHealth: 88,
        agreedPayout: 5000000,
        targetSellingPrice: 5500000,
        intakeDate: '2026-11-01',
      };

      const result = await service.createConsignment(dto, SHOP_ID, USER_ID);

      expect(result.id).toBe(CONSIGNMENT_ID);
      expect(result.consignmentNo).toBe('CON-0001');
      expect(result.agreedPayout).toBe(5000000);
      expect(tx.consignment.create).toHaveBeenCalledTimes(1);
      expect(tx.inventoryUnit.create).toHaveBeenCalledTimes(1);
      expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(1);
    });

    it('creates a new consignment agreement when imei2 is omitted', async () => {
      prismaStub.consignment.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeMockConsignmentRow({ imei2: null }));
      prismaStub.product.findFirst.mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'iPhone 13',
        trackingType: 'SERIALIZED',
        brand: { name: 'Apple' },
      });
      prismaStub.inventoryUnit.findFirst.mockResolvedValueOnce(null);

      const tx = makeTx();
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000019',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        agreedPayout: 5000000,
        intakeDate: '2026-11-01',
      };

      const result = await service.createConsignment(dto, SHOP_ID, USER_ID);

      expect(result.id).toBe(CONSIGNMENT_ID);
      expect(tx.consignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imei1: '356938035643803',
            imei2: null,
          }),
        }),
      );
      expect(tx.inventoryUnit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imei1: '356938035643803',
            imei2: null,
          }),
        }),
      );
    });

    it('returns a consignment agreement to owner', async () => {
      const tx = makeTx({
        $queryRaw: jest.fn().mockResolvedValueOnce([
          {
            id: CONSIGNMENT_ID,
            consignment_no: 'CON-0001',
            status: ConsignmentStatus.IN_CUSTODY,
            product_id: PRODUCT_ID,
          },
        ]),
      });
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: ReturnConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000020',
        returnReason: 'Customer requested phone back',
      };

      const result = await service.returnConsignment(
        CONSIGNMENT_ID,
        dto,
        SHOP_ID,
        USER_ID,
      );

      expect(result.status).toBe(true);
      expect(tx.consignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ConsignmentStatus.RETURNED_TO_OWNER,
            returnReason: 'Customer requested phone back',
          }),
        }),
      );
      expect(tx.inventoryUnit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: UnitStatus.VOIDED },
        }),
      );
    });

    it('settles a sold consignment with owner via cash when drawer has funds', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(
        makeMockConsignmentRow({
          status: ConsignmentStatus.SETTLED,
          settledAmount: 5000000n,
          payoutMethod: PaymentMethod.CASH,
        }),
      );

      const tx = makeTx({
        $queryRaw: jest.fn().mockResolvedValueOnce([
          {
            id: CONSIGNMENT_ID,
            consignment_no: 'CON-0001',
            status: ConsignmentStatus.SOLD,
            agreed_payout: 5000000n,
            consignor_name: 'Muhammad Ali',
          },
        ]),
        cashMovement: {
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({ _sum: { amount: 10000000n } })
            .mockResolvedValueOnce({ _sum: { amount: 0n } }),
          create: jest.fn().mockResolvedValue({ id: 'cash-1' }),
        },
      });
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: SettleConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000030',
        payoutMethod: PaymentMethod.CASH,
      };

      const result = await service.settleConsignment(
        CONSIGNMENT_ID,
        dto,
        SHOP_ID,
        USER_ID,
      );

      expect(result).toHaveProperty('id', CONSIGNMENT_ID);
      expect(result).toHaveProperty('status', ConsignmentStatus.SETTLED);
      expect(tx.consignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ConsignmentStatus.SETTLED,
            payoutMethod: PaymentMethod.CASH,
            settledAmount: 5000000n,
          }),
        }),
      );
    });

    it('cancels an active intake consignment agreement', async () => {
      const tx = makeTx({
        $queryRaw: jest.fn().mockResolvedValueOnce([
          {
            id: CONSIGNMENT_ID,
            consignment_no: 'CON-0001',
            status: ConsignmentStatus.IN_CUSTODY,
            product_id: PRODUCT_ID,
          },
        ]),
      });
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: CancelConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000040',
        cancelReason: 'Entered duplicate entry by mistake',
      };

      const result = await service.cancelConsignment(
        CONSIGNMENT_ID,
        dto,
        SHOP_ID,
        USER_ID,
      );

      expect(result.status).toBe(true);
      expect(tx.consignment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ConsignmentStatus.CANCELLED,
            cancelReason: 'Entered duplicate entry by mistake',
          }),
        }),
      );
    });
  });

  describe('2. Negative Tests - Boundary, Zero & Invalid Inputs', () => {
    it('rejects consignment when imei1 and imei2 are identical', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(null);

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000011',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        imei2: '356938035643803',
        agreedPayout: 5000000,
        intakeDate: '2026-11-01',
      };

      await expect(
        service.createConsignment(dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects battery health on non-Apple brand phone', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(null);
      prismaStub.product.findFirst.mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'Samsung Galaxy S22',
        trackingType: 'SERIALIZED',
        brand: { name: 'Samsung' },
      });

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000012',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        imei2: '356938035643804',
        batteryHealth: 90,
        agreedPayout: 5000000,
        intakeDate: '2026-11-01',
      };

      await expect(
        service.createConsignment(dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects battery health outside 1-100 range', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(null);
      prismaStub.product.findFirst.mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'iPhone 13',
        trackingType: 'SERIALIZED',
        brand: { name: 'Apple' },
      });

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000013',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        imei2: '356938035643804',
        batteryHealth: 150,
        agreedPayout: 5000000,
        intakeDate: '2026-11-01',
      };

      await expect(
        service.createConsignment(dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects consignment for non-serialized accessory product', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(null);
      prismaStub.product.findFirst.mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: '20W USB-C Charger',
        trackingType: 'QUANTITY',
        brand: { name: 'Apple' },
      });

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000014',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        imei2: '356938035643804',
        agreedPayout: 500000,
        intakeDate: '2026-11-01',
      };

      await expect(
        service.createConsignment(dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Negative Tests - Adverse State & Lifecycle Violations', () => {
    it('returns idempotency replay response when clientRequestId already processed', async () => {
      prismaStub.consignment.findFirst
        .mockResolvedValueOnce({ id: CONSIGNMENT_ID })
        .mockResolvedValueOnce(makeMockConsignmentRow());

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000015',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        imei2: '356938035643804',
        agreedPayout: 5000000,
        intakeDate: '2026-11-01',
      };

      const result = await service.createConsignment(dto, SHOP_ID, USER_ID);

      expect(result.id).toBe(CONSIGNMENT_ID);
      expect(result.consignmentNo).toBe('CON-0001');
      expect(prismaStub.$transaction).not.toHaveBeenCalled();
    });

    it('rejects intake when IMEI is already active in stock in this shop', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(null);
      prismaStub.product.findFirst.mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'iPhone 13',
        trackingType: 'SERIALIZED',
        brand: { name: 'Apple' },
      });
      prismaStub.inventoryUnit.findFirst.mockResolvedValueOnce({
        imei1: '356938035643803',
        imei2: '356938035643804',
      });

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000016',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        imei2: '356938035643804',
        agreedPayout: 5000000,
        intakeDate: '2026-11-01',
      };

      await expect(
        service.createConsignment(dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects returning a consignment phone that has already been sold', async () => {
      const tx = makeTx({
        $queryRaw: jest.fn().mockResolvedValueOnce([
          {
            id: CONSIGNMENT_ID,
            consignment_no: 'CON-0001',
            status: ConsignmentStatus.SOLD,
            product_id: PRODUCT_ID,
          },
        ]),
      });
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: ReturnConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000021',
        returnReason: 'Customer wants it back',
      };

      await expect(
        service.returnConsignment(CONSIGNMENT_ID, dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects settling payout for a phone that has not been sold yet', async () => {
      const tx = makeTx({
        $queryRaw: jest.fn().mockResolvedValueOnce([
          {
            id: CONSIGNMENT_ID,
            consignment_no: 'CON-0001',
            status: ConsignmentStatus.IN_CUSTODY,
            agreed_payout: 5000000n,
            consignor_name: 'Muhammad Ali',
          },
        ]),
      });
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: SettleConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000031',
        payoutMethod: PaymentMethod.CASH,
      };

      await expect(
        service.settleConsignment(CONSIGNMENT_ID, dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns cash shortfall overdraft warning when drawer has insufficient funds and confirmOverdraft is omitted', async () => {
      const tx = makeTx({
        $queryRaw: jest.fn().mockResolvedValueOnce([
          {
            id: CONSIGNMENT_ID,
            consignment_no: 'CON-0001',
            status: ConsignmentStatus.SOLD,
            agreed_payout: 5000000n,
            consignor_name: 'Muhammad Ali',
          },
        ]),
        cashMovement: {
          aggregate: jest
            .fn()
            .mockResolvedValueOnce({ _sum: { amount: 1000000n } })
            .mockResolvedValueOnce({ _sum: { amount: 0n } }),
          create: jest.fn(),
        },
      });
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: SettleConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000032',
        payoutMethod: PaymentMethod.CASH,
        confirmOverdraft: false,
      };

      const result = await service.settleConsignment(
        CONSIGNMENT_ID,
        dto,
        SHOP_ID,
        USER_ID,
      );

      expect(result).toBeInstanceOf(PurchaseOverdraftResponseDto);
      expect((result as PurchaseOverdraftResponseDto).confirmOverdraft).toBe(
        true,
      );
      expect((result as PurchaseOverdraftResponseDto).shortfall).toBe(4000000);
      expect(tx.cashMovement.create).not.toHaveBeenCalled();
    });

    it('rejects cancellation of a consignment that is already settled', async () => {
      const tx = makeTx({
        $queryRaw: jest.fn().mockResolvedValueOnce([
          {
            id: CONSIGNMENT_ID,
            consignment_no: 'CON-0001',
            status: ConsignmentStatus.SETTLED,
            product_id: PRODUCT_ID,
          },
        ]),
      });
      prismaStub.$transaction.mockImplementationOnce(
        (cb: (txClient: TxStub) => unknown) => cb(tx),
      );

      const dto: CancelConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000041',
        cancelReason: 'Wrong record',
      };

      await expect(
        service.cancelConsignment(CONSIGNMENT_ID, dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Negative Tests - Tenant & Permission Boundaries', () => {
    it('rejects intake when product belongs to another shop', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(null);
      prismaStub.product.findFirst.mockResolvedValueOnce(null);

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000017',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: 'other-shop-product-id',
        imei1: '356938035643803',
        imei2: '356938035643804',
        agreedPayout: 5000000,
        intakeDate: '2026-11-01',
      };

      await expect(
        service.createConsignment(dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects intake when customer belongs to another shop', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(null);
      prismaStub.product.findFirst.mockResolvedValueOnce({
        id: PRODUCT_ID,
        name: 'iPhone 13',
        trackingType: 'SERIALIZED',
        brand: { name: 'Apple' },
      });
      prismaStub.customer.findFirst.mockResolvedValueOnce(null);

      const dto: CreateConsignmentDto = {
        clientRequestId: '01924f0a-0000-7000-8000-000000000018',
        customerId: 'other-shop-customer-id',
        consignorName: 'Muhammad Ali',
        consignorPhone: '03001234567',
        productId: PRODUCT_ID,
        imei1: '356938035643803',
        imei2: '356938035643804',
        agreedPayout: 5000000,
        intakeDate: '2026-11-01',
      };

      await expect(
        service.createConsignment(dto, SHOP_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when fetching a consignment belonging to another shop', async () => {
      prismaStub.consignment.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getConsignmentById('other-shop-consignment', SHOP_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
