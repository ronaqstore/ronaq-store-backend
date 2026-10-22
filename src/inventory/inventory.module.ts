import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StoreModule } from '../store/store.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';
import { InventoryController } from './controllers/inventory.controller.js';
import { InventoryService } from './services/inventory.service.js';

@Module({
  imports: [PrismaModule, StoreModule],
  controllers: [InventoryController],
  providers: [InventoryService, AppConfigurationService],
})
export class InventoryModule {}
