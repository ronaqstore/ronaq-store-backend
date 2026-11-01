import { Module } from '@nestjs/common';
import { ConsignmentsController } from './controllers/consignments.controller.js';
import { ConsignmentsService } from './services/consignments.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ConsignmentsController],
  providers: [ConsignmentsService, AppConfigurationService],
  exports: [ConsignmentsService],
})
export class ConsignmentsModule {}

