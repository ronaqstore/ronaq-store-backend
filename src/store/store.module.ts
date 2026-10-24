import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationModule } from '../app-configuration/app-configuration.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';
import { StoreController } from './controllers/store.controller.js';
import { StoreBrandingController } from './controllers/store-branding.controller.js';
import { StorePreviewController } from './controllers/store-preview.controller.js';
import { StorefrontController } from './controllers/storefront.controller.js';
import { MarketplaceController } from './controllers/marketplace.controller.js';
import { ProductImagesController } from './controllers/product-images.controller.js';
import { StoreService } from './services/store.service.js';
import { StoreBrandingService } from './services/store-branding.service.js';
import { StorefrontService } from './services/storefront.service.js';
import { MarketplaceService } from './services/marketplace.service.js';
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
    MarketplaceController,
    ProductImagesController,
  ],
  providers: [
    StoreService,
    StoreBrandingService,
    StorefrontService,
    MarketplaceService,
    StoreCacheService,
    StorefrontRevalidateService,
    R2StorageService,
    AppConfigurationService,
  ],

  exports: [
    StoreService,
    StoreBrandingService,
    StorefrontService,
    MarketplaceService,
    StoreCacheService,
    StorefrontRevalidateService,
  ],
})
export class StoreModule {}
