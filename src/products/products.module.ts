import { Module } from '@nestjs/common';
import { ProductsController } from './controllers/products.controller.js';
import { ProductsService } from './services/products.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StoreModule } from '../store/store.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';

@Module({
  imports: [PrismaModule, StoreModule],
  controllers: [ProductsController],
  providers: [ProductsService, AppConfigurationService],
  exports: [ProductsService],
})
export class ProductsModule {}
