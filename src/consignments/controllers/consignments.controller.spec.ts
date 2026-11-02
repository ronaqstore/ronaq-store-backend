import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConsignmentsController } from './consignments.controller.js';
import { ConsignmentsService } from '../services/consignments.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { ResponseConsignmentDto } from '../dto/response-consignment.dto.js';
import { CreateConsignmentDto } from '../dto/create-consignment.dto.js';
import { SettleConsignmentDto } from '../dto/settle-consignment.dto.js';
import { ReturnConsignmentDto } from '../dto/return-consignment.dto.js';
import { CancelConsignmentDto } from '../dto/cancel-consignment.dto.js';
import { PaymentMethod } from '../../generated/prisma/enums.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';

const SHOP_ID = '01924f0a-0000-7000-8000-000000000001';
const USER_ID = '01924f0a-0000-7000-8000-000000000002';
const CONSIGNMENT_ID = '01924f0a-0000-7000-8000-000000000005';

const reqStub = {
  user: { shopId: SHOP_ID, userId: USER_ID },
} as unknown as OwnerRequest;

describe('ConsignmentsController', () => {
  let controller: ConsignmentsController;
  let service: ConsignmentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const serviceMock = {
      createConsignment: jest
        .fn()
        .mockResolvedValue(new ResponseConsignmentDto()),
      listConsignments: jest
        .fn()
        .mockResolvedValue(
          new PaginatedResponseDTO<ResponseConsignmentDto>([], 1, 10, 0),
        ),
      getConsignmentById: jest
        .fn()
        .mockResolvedValue(new ResponseConsignmentDto()),
      returnConsignment: jest
        .fn()
        .mockResolvedValue(
          new StatusBaseResponseDTO(
            true,
            'Consignment returned successfully',
            CONSIGNMENT_ID,
          ),
        ),
      settleConsignment: jest
        .fn()
        .mockResolvedValue(new ResponseConsignmentDto()),
      cancelConsignment: jest
        .fn()
        .mockResolvedValue(
          new StatusBaseResponseDTO(
            true,
            'Consignment cancelled successfully',
            CONSIGNMENT_ID,
          ),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsignmentsController],
      providers: [
        { provide: ConsignmentsService, useValue: serviceMock },
        { provide: PrismaService, useValue: {} },
        {
          provide: AppConfigurationService,
          useValue: { jwtSecret: 'test-secret' },
        },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConsignmentsController>(ConsignmentsController);
    service = module.get<ConsignmentsService>(ConsignmentsService);
  });

  it('delegates createConsignment to service with shopId and userId', async () => {
    const spy = jest.spyOn(service, 'createConsignment');
    const dto: CreateConsignmentDto = {
      clientRequestId: '01924f0a-0000-7000-8000-000000000010',
      consignorName: 'Muhammad Ali',
      consignorPhone: '03001234567',
      productId: 'prod-1',
      imei1: '356938035643803',
      imei2: '356938035643804',
      agreedPayout: 5000000,
      intakeDate: '2026-11-01',
    };

    const response = await controller.createConsignment(dto, reqStub);

    expect(response.message).toBeDefined();
    expect(response.data).toBeDefined();
    expect(spy).toHaveBeenCalledWith(dto, SHOP_ID, USER_ID);
  });

  it('delegates listConsignments to service', async () => {
    const spy = jest.spyOn(service, 'listConsignments');
    const response = await controller.listConsignments({}, reqStub);

    expect(response.message).toBeDefined();
    expect(response.data).toBeDefined();
    expect(spy).toHaveBeenCalledWith({}, SHOP_ID);
  });

  it('delegates getConsignmentById to service', async () => {
    const spy = jest.spyOn(service, 'getConsignmentById');
    const response = await controller.getConsignmentById(
      CONSIGNMENT_ID,
      reqStub,
    );

    expect(response.message).toBeDefined();
    expect(response.data).toBeDefined();
    expect(spy).toHaveBeenCalledWith(CONSIGNMENT_ID, SHOP_ID);
  });

  it('delegates returnConsignment to service', async () => {
    const spy = jest.spyOn(service, 'returnConsignment');
    const dto: ReturnConsignmentDto = {
      clientRequestId: '01924f0a-0000-7000-8000-000000000020',
      returnReason: 'Customer requested phone back',
    };

    const response = await controller.returnConsignment(
      CONSIGNMENT_ID,
      dto,
      reqStub,
    );

    expect(response.message).toBeDefined();
    expect(response.data).toBeDefined();
    expect(spy).toHaveBeenCalledWith(CONSIGNMENT_ID, dto, SHOP_ID, USER_ID);
  });

  it('delegates settleConsignment to service', async () => {
    const spy = jest.spyOn(service, 'settleConsignment');
    const dto: SettleConsignmentDto = {
      clientRequestId: '01924f0a-0000-7000-8000-000000000030',
      payoutMethod: PaymentMethod.CASH,
    };

    const response = await controller.settleConsignment(
      CONSIGNMENT_ID,
      dto,
      reqStub,
    );

    expect(response.message).toBeDefined();
    expect(response.data).toBeDefined();
    expect(spy).toHaveBeenCalledWith(CONSIGNMENT_ID, dto, SHOP_ID, USER_ID);
  });

  it('delegates cancelConsignment to service', async () => {
    const spy = jest.spyOn(service, 'cancelConsignment');
    const dto: CancelConsignmentDto = {
      clientRequestId: '01924f0a-0000-7000-8000-000000000040',
      cancelReason: 'Entered by mistake',
    };

    const response = await controller.cancelConsignment(
      CONSIGNMENT_ID,
      dto,
      reqStub,
    );

    expect(response.message).toBeDefined();
    expect(response.data).toBeDefined();
    expect(spy).toHaveBeenCalledWith(CONSIGNMENT_ID, dto, SHOP_ID, USER_ID);
  });
});
