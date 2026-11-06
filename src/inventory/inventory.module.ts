import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StoreModule } from '../store/store.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';
import { InventoryController } from './controllers/inventory.controller.js';
import { InventoryService } from './services/inventory.service.js';
import { InventoryAdjustmentService } from './services/inventory-adjustment.service.js';
import { ImeiLookupService } from './services/imei-lookup.service.js';
import { DeadStockReportService } from './services/dead-stock-report.service.js';

@Module({
  imports: [PrismaModule, StoreModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryAdjustmentService,
    ImeiLookupService,
    DeadStockReportService,
    AppConfigurationService,
  ],
  exports: [InventoryService, ImeiLookupService, DeadStockReportService],
})
export class InventoryModule {}
