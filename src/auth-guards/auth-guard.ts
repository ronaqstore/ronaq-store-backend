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
import { ShopStatus, UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  invalidToken,
  shopSuspended,
  userSuspended,
} from '../errors/error.builder.js';
import { AuthenticatedOwner, AuthTokenType } from './auth-token.js';
import { JwtGuardBase } from './jwt-guard.base.js';

@Injectable()
export class AuthGuard extends JwtGuardBase implements CanActivate {
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
      AuthTokenType.OWNER,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      include: { shop: true },
    });

    if (!user) {
      throw new UnauthorizedException(invalidToken());
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(userSuspended());
    }

    if (
      user.shop.status !== ShopStatus.ACTIVE ||
      user.shop.subscriptionEndsAt.getTime() <= Date.now()
    ) {
      throw new ForbiddenException(shopSuspended());
    }

    const authenticatedUser: AuthenticatedOwner = {
      userId: user.id,
      shopId: user.shopId,
      role: user.role,
    };

    (request as Request & { user: AuthenticatedOwner }).user =
      authenticatedUser;

    return true;
  }
}
