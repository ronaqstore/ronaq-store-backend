import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StaffController } from './staff.controller.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';

describe('StaffController', () => {
  let controller: StaffController;
  let mockService: any;

  const SHOP_ID = '01924f0a-0000-7000-8000-000000000001';
  const OWNER_ID = '01924f0a-0000-7000-8000-000000000002';
  const STAFF_ID = '01924f0a-0000-7000-8000-000000000003';

  const mockReq: OwnerRequest = {
    user: {
      userId: OWNER_ID,
      shopId: SHOP_ID,
      role: UserRole.OWNER,
    },
  } as unknown as OwnerRequest;

  beforeEach(() => {
    mockService = {
      listStaff: jest.fn(),
      createStaff: jest.fn(),
      updateStaff: jest.fn(),
      deleteStaff: jest.fn(),
    };

    controller = new StaffController(mockService);
  });

  describe('Happy Path', () => {
    it('successfully calls list, create, update, and delete staff', async () => {
      const sampleStaff = {
        id: STAFF_ID,
        shopId: SHOP_ID,
        name: 'Asad',
        phone: '923001234567',
        role: UserRole.SALESMAN,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockService.listStaff.mockResolvedValueOnce([sampleStaff]);
      const listRes = await controller.listStaff(mockReq);
      expect(listRes.data).toHaveLength(1);

      mockService.createStaff.mockResolvedValueOnce(sampleStaff);
      const createRes = await controller.createStaff(
        {
          name: 'Asad',
          phone: '03001234567',
          role: UserRole.SALESMAN,
          password: 'Password123',
        },
        mockReq,
      );
      expect(createRes.data.id).toBe(STAFF_ID);

      mockService.updateStaff.mockResolvedValueOnce({
        ...sampleStaff,
        role: UserRole.MANAGER,
      });
      const updateRes = await controller.updateStaff(
        STAFF_ID,
        { role: UserRole.MANAGER },
        mockReq,
      );
      expect(updateRes.data.role).toBe(UserRole.MANAGER);

      mockService.deleteStaff.mockResolvedValueOnce({
        success: true,
        message: 'Staff member suspended successfully',
      });
      const deleteRes = await controller.deleteStaff(STAFF_ID, mockReq);
      expect(deleteRes.data.success).toBe(true);
    });
  });

  describe('Negative 1: Business Rule Validation Failures', () => {
    it('propagates BadRequestException and ConflictException from service', async () => {
      mockService.createStaff.mockRejectedValueOnce(
        new ConflictException('Phone already exists'),
      );

      await expect(
        controller.createStaff(
          {
            name: 'Duplicate',
            phone: '03001234567',
            role: UserRole.SALESMAN,
            password: 'Password123',
          },
          mockReq,
        ),
      ).rejects.toThrow(ConflictException);

      mockService.updateStaff.mockRejectedValueOnce(
        new BadRequestException('Cannot demote owner'),
      );

      await expect(
        controller.updateStaff(OWNER_ID, { role: UserRole.SALESMAN }, mockReq),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Negative 2: Non-Existent Records', () => {
    it('propagates NotFoundException when staff member is not found', async () => {
      mockService.updateStaff.mockRejectedValueOnce(
        new NotFoundException('Staff user not found'),
      );

      await expect(
        controller.updateStaff('unknown', { name: 'New' }, mockReq),
      ).rejects.toThrow(NotFoundException);

      mockService.deleteStaff.mockRejectedValueOnce(
        new NotFoundException('Staff user not found'),
      );

      await expect(controller.deleteStaff('unknown', mockReq)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Negative 3: Unexpected Failures', () => {
    it('wraps unhandled service errors as InternalServerErrorException', async () => {
      mockService.listStaff.mockRejectedValueOnce(
        new Error('Database connectivity error'),
      );

      await expect(controller.listStaff(mockReq)).rejects.toThrow(
        InternalServerErrorException,
      );

      mockService.createStaff.mockRejectedValueOnce(
        new Error('Unexpected error'),
      );

      await expect(
        controller.createStaff(
          {
            name: 'Test',
            phone: '03001234567',
            role: UserRole.SALESMAN,
            password: 'Password123',
          },
          mockReq,
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
