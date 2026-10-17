import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';
import { ReportsController } from './controllers/reports.controller.js';
import { ReportsSnapshotController } from './controllers/reports-snapshot.controller.js';
import { ReportsService } from './services/reports.service.js';
import { ReportsLedgerService } from './services/reports-ledger.service.js';
import { ReportsAnalyticsService } from './services/reports-analytics.service.js';
import { ReportsQueryHelper } from './services/reports-query.helper.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController, ReportsSnapshotController],
  providers: [
    ReportsService,
    ReportsLedgerService,
    ReportsAnalyticsService,
    ReportsQueryHelper,
    AppConfigurationService,
  ],
})
export class ReportsModule {}
