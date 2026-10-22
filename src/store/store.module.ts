import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationModule } from '../app-configuration/app-configuration.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';
import { StoreController } from './controllers/store.controller.js';
import { StoreBrandingController } from './controllers/store-branding.controller.js';
import { StorePreviewController } from './controllers/store-preview.controller.js';
import { StorefrontController } from './controllers/storefront.controller.js';
import { ProductImagesController } from './controllers/product-images.controller.js';
import { StoreService } from './services/store.service.js';
import { StoreBrandingService } from './services/store-branding.service.js';
import { StorefrontService } from './services/storefront.service.js';
import { StoreCacheService } from './services/store-cache.service.js';
import { StorefrontRevalidateService } from './services/storefront-revalidate.service.js';
import { R2StorageService } from './services/r2-storage.service.js';

@Module({
  imports: [PrismaModule, AppConfigurationModule],

  controllers: [
    StoreController,
    StoreBrandingController,
    StorePreviewController,
    StorefrontController,
    ProductImagesController,
  ],
  providers: [
    StoreService,
    StoreBrandingService,
    StorefrontService,
    StoreCacheService,
    StorefrontRevalidateService,
    R2StorageService,
    AppConfigurationService,
  ],

  exports: [
    StoreService,
    StoreBrandingService,
    StorefrontService,
    StoreCacheService,
    StorefrontRevalidateService,
  ],
})
export class StoreModule {}
