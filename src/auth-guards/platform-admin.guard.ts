import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppConfigurationService } from '../app-configuration/app-configuration.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { adminAccountDisabled, invalidToken } from '../errors/error.builder.js';
import { AuthenticatedPlatformAdmin, AuthTokenType } from './auth-token.js';
import { JwtGuardBase } from './jwt-guard.base.js';

@Injectable()
export class PlatformAdminGuard extends JwtGuardBase implements CanActivate {
  constructor(
    jwtService: JwtService,
    configService: AppConfigurationService,
    prisma: PrismaService,
  ) {
    super(jwtService, configService, prisma);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { request, sub } = await this.bearerPayload(
      context,
      AuthTokenType.PLATFORM_ADMIN,
    );

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: sub },
      select: { id: true, name: true, isActive: true },
    });

    if (!admin) {
      throw new UnauthorizedException(invalidToken());
    }

    if (!admin.isActive) {
      throw new ForbiddenException(adminAccountDisabled());
    }

    const authenticatedAdmin: AuthenticatedPlatformAdmin = {
      adminId: admin.id,
      name: admin.name,
    };

    (request as Request & { user: AuthenticatedPlatformAdmin }).user =
      authenticatedAdmin;

    return true;
  }
}
