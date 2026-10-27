import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller.js';
import { DashboardShopController } from './controllers/dashboard-shop.controller.js';
import { DashboardPlatformController } from './controllers/dashboard-platform.controller.js';
import { DashboardService } from './services/dashboard.service.js';
import { DashboardShopService } from './services/dashboard-shop.service.js';
import { DashboardFlowService } from './services/dashboard-flow.service.js';
import { DashboardReceivablesService } from './services/dashboard-receivables.service.js';
import { DashboardProductsService } from './services/dashboard-products.service.js';
import { DashboardInventoryService } from './services/dashboard-inventory.service.js';
import { DashboardCacheService } from './services/dashboard-cache.service.js';
import { DashboardPlatformService } from './services/dashboard-platform.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [
    DashboardController,
    DashboardShopController,
    DashboardPlatformController,
  ],
  providers: [
    DashboardService,
    DashboardShopService,
    DashboardFlowService,
    DashboardReceivablesService,
    DashboardProductsService,
    DashboardInventoryService,
    DashboardCacheService,
    DashboardPlatformService,
    AppConfigurationService,
  ],
  exports: [
    DashboardService,
    DashboardShopService,
    DashboardFlowService,
    DashboardReceivablesService,
    DashboardProductsService,
    DashboardInventoryService,
    DashboardCacheService,
    DashboardPlatformService,
  ],
})
export class DashboardModule {}
