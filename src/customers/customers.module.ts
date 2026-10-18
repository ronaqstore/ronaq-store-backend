import { Module } from '@nestjs/common';
import { CustomersController } from './controllers/customers.controller.js';
import { CustomersService } from './services/customers.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [CustomersService, AppConfigurationService],
})
export class CustomersModule {}
