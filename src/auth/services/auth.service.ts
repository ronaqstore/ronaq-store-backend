import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ShopStatus, UserStatus } from '../../generated/prisma/enums.js';
import {
  currentPasswordIncorrect,
  invalidCredentials,
  invalidSetupToken,
  resourceNotFound,
  shopSuspended,
  userSuspended,
  adminAccountDisabled,
  loginPhoneAlreadyTaken,
} from '../../errors/error.builder.js';
import { buildOwnerAuthResponseBody } from '../../helpers/owner-auth-response.helper.js';
import { normalizePhone } from '../../helpers/phone.helper.js';
import { findLoginPhoneConflict } from '../../helpers/login-phone.helper.js';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  isWellFormedToken,
} from '../../helpers/token.helper.js';
import { logInfo } from '../../helpers/logger-helper.js';
import { AuthTokenType } from '../../auth-guards/auth-token.js';
import type { SignTokenClaims } from './auth.service.types.js';
import { OwnerLoginDto } from '../dto/owner-login.dto.js';
import { PlatformAdminLoginDto } from '../dto/platform-admin-login.dto.js';
import { SetupPasswordDto } from '../dto/setup-password.dto.js';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import {
  OwnerLoginResponseDto,
  PlatformAdminLoginResponseDto,
} from '../dto/login-response.dto.js';
import { MeResponseDto } from '../dto/me-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { RegisterOwnerDto } from '../dto/register-owner.dto.js';
import {
  DEFAULT_BRANDS,
  DEFAULT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  WALK_IN_SUPPLIER,
} from '../../platform-admin/constants/default-lists.constant.js';
import {
  nextFreeStoreSlug,
  storeSlugBase,
} from '../../store/helpers/store-slug.helper.js';
import {
  findMarketplaceHub,
  resolveMarketplaceCityName,
} from '../../store/helpers/marketplace-hub.helper.js';

const TIMING_EQUALISER_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.7QGK2M4Yw1nBqzYlJ0Z7iVfZ1zUq7r2K';

const SETUP_PASSWORD_PATH = '/setup-password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigurationService,
  ) {}

  async registerOwner(dto: RegisterOwnerDto): Promise<OwnerLoginResponseDto> {
    const ownerPhone = normalizePhone(dto.phone);
    if (!ownerPhone) {
      throw new BadRequestException(
        'Please provide a valid Pakistani mobile number (e.g. 03001234567)',
      );
    }

    const phoneConflict = await findLoginPhoneConflict(this.prisma, ownerPhone);
    if (phoneConflict) {
      throw new BadRequestException(
        phoneConflict === 'PLATFORM_ADMIN'
          ? 'This mobile number is already registered. Use a different number.'
          : loginPhoneAlreadyTaken(ownerPhone),
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.configService.bcryptRounds,
    );
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 30);

    const shopName = dto.shopName.trim();
    const ownerName = (dto.fullName || dto.name)?.trim();
    if (!ownerName) {
      throw new BadRequestException('Full name is required');
    }

    const resolvedAddress = (dto.address || dto.shopAddress)?.trim() ?? null;
    const resolvedCity = resolveMarketplaceCityName(dto.city);
    if (!resolvedCity) {
      throw new BadRequestException(
        'Please select a valid KPK city from the list',
      );
    }
    const hub = findMarketplaceHub(resolvedCity);

    const { shop, user } = await this.prisma.$transaction(async (tx) => {
      const newShop = await tx.shop.create({
        data: {
          name: shopName,
          phone: dto.shopPhone
            ? (normalizePhone(dto.shopPhone) ?? dto.shopPhone)
            : ownerPhone,
          address: resolvedAddress,
          status: ShopStatus.ACTIVE,
          subscriptionEndsAt,
        },
      });

      const newUser = await tx.user.create({
        data: {
          shopId: newShop.id,
          name: ownerName,
          phone: ownerPhone,
          passwordHash,
          role: 'OWNER',
          status: UserStatus.ACTIVE,
        },
      });

      if (DEFAULT_CATEGORIES.length > 0) {
        await tx.category.createMany({
          data: DEFAULT_CATEGORIES.map((name) => ({
            shopId: newShop.id,
            name,
          })),
        });
      }

      if (DEFAULT_BRANDS.length > 0) {
        await tx.brand.createMany({
          data: DEFAULT_BRANDS.map((name) => ({
            shopId: newShop.id,
            name,
          })),
        });
      }

      if (DEFAULT_EXPENSE_CATEGORIES.length > 0) {
        await tx.expenseCategory.createMany({
          data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
            shopId: newShop.id,
            name,
          })),
        });
      }

      await tx.supplier.create({
        data: {
          shopId: newShop.id,
          name: WALK_IN_SUPPLIER.name,
          notes: WALK_IN_SUPPLIER.notes,
          isSystem: WALK_IN_SUPPLIER.isSystem,
        },
      });

      const storeSlug = await nextFreeStoreSlug(
        storeSlugBase(newShop.name, newShop.id),
        async (candidate) =>
          Boolean(
            await tx.shopStoreSettings.findUnique({
              where: { slug: candidate },
              select: { slug: true },
            }),
          ),
      );

      await tx.shopStoreSettings.create({
        data: {
          shopId: newShop.id,
          slug: storeSlug,
          isEnabled: true,
          displayName: newShop.name.trim().slice(0, 100),
          phoneNumber: newShop.phone,
          address: resolvedAddress,
          city: resolvedCity,
          latitude: hub?.latitude ?? null,
          longitude: hub?.longitude ?? null,
          mapPlaceName: resolvedCity,
        },
      });

      return { shop: newShop, user: newUser };
    });

    logInfo(
      'auth.service.ts',
      'registerOwner',
      `Owner "${ownerName}" registered with shop "${shopName}"`,
    );

    const accessToken = await this.signToken({
      sub: user.id,
      typ: AuthTokenType.OWNER,
      shopId: user.shopId,
      role: user.role,
    });

    return buildOwnerAuthResponseBody(
      accessToken,
      this.configService.jwtExpiresIn,
      user,
      shop,
    );
  }

  async ownerLogin(dto: OwnerLoginDto): Promise<OwnerLoginResponseDto> {
    const phone = normalizePhone(dto.phone);

    if (!phone) {
      throw new UnauthorizedException(invalidCredentials());
    }

    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { shop: true },
    });

    if (!user) {
      await bcrypt.compare(dto.password, TIMING_EQUALISER_HASH);
      throw new UnauthorizedException(invalidCredentials());
    }

    if (!user.passwordHash) {
      await bcrypt.compare(dto.password, TIMING_EQUALISER_HASH);
      throw new UnauthorizedException(invalidCredentials());
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(invalidCredentials());
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

    const accessToken = await this.signToken({
      sub: user.id,
      typ: AuthTokenType.OWNER,
      shopId: user.shopId,
      role: user.role,
    });

    return buildOwnerAuthResponseBody(
      accessToken,
      this.configService.jwtExpiresIn,
      user,
      user.shop,
    );
  }

  async platformAdminLogin(
    dto: PlatformAdminLoginDto,
  ): Promise<PlatformAdminLoginResponseDto> {
    const raw = dto.phone.trim().toLowerCase();
    const phone = normalizePhone(dto.phone) ?? raw;

    if (!phone) {
      throw new UnauthorizedException(invalidCredentials());
    }

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { phone },
    });

    if (!admin) {
      await bcrypt.compare(dto.password, TIMING_EQUALISER_HASH);
      throw new UnauthorizedException(invalidCredentials());
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(invalidCredentials());
    }

    if (!admin.isActive) {
      throw new ForbiddenException(adminAccountDisabled());
    }

    const accessToken = await this.signToken({
      sub: admin.id,
      typ: AuthTokenType.PLATFORM_ADMIN,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.jwtExpiresIn,
      admin: { id: admin.id, name: admin.name, phone: admin.phone },
    };
  }

  async buildSetupLink(
    userId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<{ setupUrl: string; expiresAt: Date }> {
    const token = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = new Date(
      Date.now() + this.configService.passwordSetupTokenTtlMinutes * 60_000,
    );

    await client.user.update({
      where: { id: userId },
      data: {
        passwordSetupTokenHash: tokenHash,
        passwordSetupExpiresAt: expiresAt,
      },
    });

    const setupUrl = `${this.configService.appBaseUrl}${SETUP_PASSWORD_PATH}?token=${token}`;

    return { setupUrl, expiresAt };
  }

  async setupPassword(dto: SetupPasswordDto): Promise<StatusBaseResponseDTO> {
    if (!isWellFormedToken(dto.token)) {
      throw new BadRequestException(invalidSetupToken());
    }

    const tokenHash = hashOpaqueToken(dto.token);

    const user = await this.prisma.user.findFirst({
      where: { passwordSetupTokenHash: tokenHash },
    });

    if (!user || !user.passwordSetupExpiresAt) {
      throw new BadRequestException(invalidSetupToken());
    }

    if (user.passwordSetupExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(invalidSetupToken());
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.configService.bcryptRounds,
    );

    const consumed = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        passwordSetupTokenHash: tokenHash,
        passwordSetupExpiresAt: { gt: new Date() },
      },
      data: {
        passwordHash,
        passwordSetupTokenHash: null,
        passwordSetupExpiresAt: null,
      },
    });

    if (consumed.count !== 1) {
      throw new BadRequestException(invalidSetupToken());
    }

    logInfo(
      'auth.service.ts',
      'setupPassword',
      `Password set for user ${user.phone}`,
      { userId: user.id, shopId: user.shopId },
    );

    return new StatusBaseResponseDTO(true, 'Password set successfully');
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<StatusBaseResponseDTO> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.passwordHash) {
      throw new NotFoundException(resourceNotFound('User', userId));
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new BadRequestException(currentPasswordIncorrect());
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      this.configService.bcryptRounds,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return new StatusBaseResponseDTO(true, 'Password changed successfully');
  }

  async getMe(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { shop: true },
    });

    if (!user) {
      throw new NotFoundException(resourceNotFound('User', userId));
    }

    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      shop: {
        id: user.shop.id,
        name: user.shop.name,
        shopStatus: user.shop.status,
        subscriptionEndsAt: user.shop.subscriptionEndsAt,
      },
    };
  }

  private async signToken(claims: SignTokenClaims): Promise<string> {
    return this.jwtService.signAsync(claims, {
      secret: this.configService.jwtSecret,
      expiresIn: this.configService.jwtExpiresIn as StringValue,
    });
  }
}
