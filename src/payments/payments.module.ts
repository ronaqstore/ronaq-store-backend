import { Module } from '@nestjs/common';
import { PaymentsController } from './controllers/payments.controller.js';
import { PaymentsService } from './services/payments.service.js';
import { PaymentsCancelService } from './services/payments-cancel.service.js';
import { PaymentsAllocationService } from './services/payments-allocation.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsCancelService,
    PaymentsAllocationService,
    AppConfigurationService,
  ],
})
export class PaymentsModule {}
