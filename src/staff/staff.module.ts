import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AppConfigurationModule } from '../app-configuration/app-configuration.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { StaffController } from './controllers/staff.controller.js';
import { StaffService } from './services/staff.service.js';

@Module({
  imports: [PrismaModule, AppConfigurationModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
