import { Module } from '@nestjs/common';
import { SaleReturnsController } from './controllers/sale-returns.controller.js';
import { ReturnsController } from './controllers/returns.controller.js';
import { ReturnsService } from './services/returns.service.js';
import { ReturnsFlowService } from './services/returns-flow.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SaleReturnsController, ReturnsController],
  providers: [ReturnsService, ReturnsFlowService, AppConfigurationService],
})
export class ReturnsModule {}
