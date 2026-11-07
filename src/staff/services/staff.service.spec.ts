import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StaffService } from './staff.service.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';

describe('StaffService', () => {
  let service: StaffService;
  let mockPrisma: any;
  let mockConfigService: any;

  const SHOP_ID = '01924f0a-0000-7000-8000-000000000001';
  const OWNER_ID = '01924f0a-0000-7000-8000-000000000002';
  const STAFF_ID = '01924f0a-0000-7000-8000-000000000003';

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      platformAdmin: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    mockConfigService = {
      bcryptRounds: 10,
    };

    service = new StaffService(mockPrisma, mockConfigService);
  });

  describe('Happy Path', () => {
    it('creates, lists, updates, and suspends staff member', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const createdUser = {
        id: STAFF_ID,
        shopId: SHOP_ID,
        name: 'Kamran Sales',
        phone: '923001234567',
        role: UserRole.SALESMAN,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.create.mockResolvedValueOnce(createdUser);

      const created = await service.createStaff(SHOP_ID, {
        name: 'Kamran Sales',
        phone: '03001234567',
        role: UserRole.SALESMAN,
        password: 'ValidPassword123',
      });

      expect(created.id).toBe(STAFF_ID);
      expect(created.role).toBe(UserRole.SALESMAN);

      mockPrisma.user.findMany.mockResolvedValueOnce([createdUser]);
      const list = await service.listStaff(SHOP_ID);
      expect(list).toHaveLength(1);

      mockPrisma.user.findFirst.mockResolvedValueOnce(createdUser);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...createdUser,
        role: UserRole.MANAGER,
      });

      const updated = await service.updateStaff(STAFF_ID, SHOP_ID, {
        role: UserRole.MANAGER,
      });
      expect(updated.role).toBe(UserRole.MANAGER);

      mockPrisma.user.findFirst.mockResolvedValueOnce(createdUser);
      mockPrisma.user.update.mockResolvedValueOnce({
        ...createdUser,
        status: UserStatus.SUSPENDED,
      });

      const deleteRes = await service.deleteStaff(STAFF_ID, SHOP_ID, OWNER_ID);
      expect(deleteRes.success).toBe(true);
    });
  });

  describe('Negative 1: Phone Conflicts and Validation', () => {
    it('rejects duplicate phone numbers and invalid phone formats', async () => {
      await expect(
        service.createStaff(SHOP_ID, {
          name: 'Invalid Phone',
          phone: '12345',
          role: UserRole.SALESMAN,
          password: 'Password123',
        }),
      ).rejects.toThrow(BadRequestException);

      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'existing-id' });

      await expect(
        service.createStaff(SHOP_ID, {
          name: 'Duplicate Phone',
          phone: '03001234567',
          role: UserRole.SALESMAN,
          password: 'Password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Negative 2: Disallowed Owner Operations', () => {
    it('blocks creating staff as OWNER, demoting OWNER, and suspending OWNER', async () => {
      await expect(
        service.createStaff(SHOP_ID, {
          name: 'Second Owner',
          phone: '03009999999',
          role: UserRole.OWNER,
          password: 'Password123',
        }),
      ).rejects.toThrow(BadRequestException);

      const ownerUser = {
        id: OWNER_ID,
        shopId: SHOP_ID,
        name: 'Shop Owner',
        phone: '923000000000',
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE,
      };

      mockPrisma.user.findFirst.mockResolvedValue(ownerUser);

      await expect(
        service.updateStaff(OWNER_ID, SHOP_ID, {
          role: UserRole.SALESMAN,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updateStaff(OWNER_ID, SHOP_ID, {
          status: UserStatus.SUSPENDED,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.deleteStaff(OWNER_ID, SHOP_ID, 'other-user'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Negative 3: Tenancy and Self Deletion', () => {
    it('rejects operations on non-existent staff and self-deletion', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateStaff('unknown-id', SHOP_ID, {
          name: 'New Name',
        }),
      ).rejects.toThrow(NotFoundException);

      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: OWNER_ID,
        shopId: SHOP_ID,
        role: UserRole.SALESMAN,
      });

      await expect(
        service.deleteStaff(OWNER_ID, SHOP_ID, OWNER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
