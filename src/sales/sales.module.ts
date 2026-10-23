import { Module } from '@nestjs/common';
import { SalesController } from './controllers/sales.controller.js';
import { SalesService } from './services/sales.service.js';
import { SalesLineWriterService } from './services/sales-line-writer.service.js';
import { SalesCancelService } from './services/sales-cancel.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StoreModule } from '../store/store.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';

@Module({
  imports: [PrismaModule, StoreModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    SalesLineWriterService,
    SalesCancelService,
    AppConfigurationService,
  ],
  exports: [SalesService],
})
export class SalesModule {}
