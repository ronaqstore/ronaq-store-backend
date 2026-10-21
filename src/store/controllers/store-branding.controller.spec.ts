import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { StoreBrandingController } from './store-branding.controller.js';
import { StoreBrandingService } from '../services/store-branding.service.js';
import { StoreCacheService } from '../services/store-cache.service.js';
import { R2StorageService } from '../services/r2-storage.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';

const prismaStub = {
  shopStoreSettings: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('StoreBrandingController', () => {
  let controller: StoreBrandingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoreBrandingController],
      providers: [
        StoreBrandingService,
        StoreCacheService,
        {
          provide: R2StorageService,
          useValue: {
            put: jest.fn().mockResolvedValue('https://pub-test.r2.dev/x.jpg'),
            deleteByUrl: jest.fn(),
            buildPublicUrl: jest.fn(),
          },
        },
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
          useValue: {
            get: jest.fn().mockReturnValue({ jwtSecret: 'test-secret' }),
            auth: { jwtSecret: 'test-secret' },
          },
        },
      ],
    }).compile();

    controller = module.get<StoreBrandingController>(StoreBrandingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
