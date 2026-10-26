import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from '../services/auth.service.js';
import { TurnstileService } from '../services/turnstile.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';

const prismaStub = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  platformAdmin: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

/**
 * Smoke test: verifies Nest can construct the auth controller. Guards and
 * their heavy dependencies are swapped out so the spec stays lightweight.
 * Real guard enforcement is covered by auth-token.spec.ts and e2e tests.
 */
describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaStub },
        {
          provide: AuthGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn(), verifyAsync: jest.fn() },
        },
        {
          provide: AppConfigurationService,
          useValue: {
            get: jest.fn().mockReturnValue({ jwtSecret: 'test-secret' }),
            auth: { jwtSecret: 'test-secret' },
            turnstileEnabled: false,
            turnstileSecretKey: '',
          },
        },
        {
          provide: TurnstileService,
          useValue: {
            assertValidToken: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
