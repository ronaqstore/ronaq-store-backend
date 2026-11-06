import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { UserRole } from '../generated/prisma/enums.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user?: { role?: UserRole }): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  describe('Happy Path', () => {
    it('allows access when user role matches required roles', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.OWNER, UserRole.MANAGER]);

      const context = createMockContext({ role: UserRole.OWNER });
      const canActivate = guard.canActivate(context);

      expect(canActivate).toBe(true);
    });
  });

  describe('Negative 1: Insufficient Permissions', () => {
    it('throws ForbiddenException when role is not in allowed list', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.OWNER, UserRole.MANAGER]);

      const context = createMockContext({ role: UserRole.SALESMAN });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('Negative 2: Missing or Incomplete User Context', () => {
    it('throws ForbiddenException when user or role is undefined', () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([UserRole.OWNER]);

      const contextNoUser = createMockContext(undefined);
      expect(() => guard.canActivate(contextNoUser)).toThrow(
        ForbiddenException,
      );

      const contextNoRole = createMockContext({ role: undefined });
      expect(() => guard.canActivate(contextNoRole)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Negative 3: Unrestricted or Default Routes', () => {
    it('allows access when no roles metadata is defined', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const context = createMockContext({ role: UserRole.SALESMAN });
      const canActivate = guard.canActivate(context);

      expect(canActivate).toBe(true);
    });
  });
});
