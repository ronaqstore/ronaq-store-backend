import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  ShopStatus,
  SubscriptionStatus,
} from '../../generated/prisma/enums.js';
import { AuthService } from '../../auth/services/auth.service.js';
import {
  normalizePhone,
  normalizePhoneOrRaw,
} from '../../helpers/phone.helper.js';
import { phoneSearchVariants } from '../../helpers/phone-search.helper.js';
import { findLoginPhoneConflict } from '../../helpers/login-phone.helper.js';
import { isUniqueConstraintViolation } from '../../helpers/prisma-error-helper.js';
import { logInfo } from '../../helpers/logger-helper.js';
import { buildTokenizedSearchAnd } from '../../helpers/tokenized-search.helper.js';
import { dateColumnRange } from '../../helpers/date.helper.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  oneOwnerPerShop,
  invalidOwnerPhone,
  ownerPhoneAlreadyRegistered,
  resourceNotFound,
  invalidSubscriptionDate,
  subscriptionEndInPast,
} from '../../errors/error.builder.js';
import {
  DEFAULT_BRANDS,
  DEFAULT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  WALK_IN_SUPPLIER,
} from '../constants/default-lists.constant.js';
import { CreateShopDto } from '../dto/create-shop.dto.js';
import { CreateShopResponseDto } from '../dto/create-shop-response.dto.js';
import {
  findMarketplaceHub,
  resolveMarketplaceCityName,
} from '../../store/helpers/marketplace-hub.helper.js';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto.js';
import { UpdateSubscriptionResponseDto } from '../dto/update-subscription-response.dto.js';
import { ShopOwnerStatusResponseDto } from '../dto/shop-owner-status-response.dto.js';
import { ChangeStoreSlugDto } from '../dto/change-store-slug.dto.js';
import { ListShopsQueryDto } from '../dto/list-shops-query.dto.js';
import { ResponsePlatformShopDto } from '../dto/response-platform-shop.dto.js';
import { PlatformOverviewResponseDto } from '../dto/platform-overview-response.dto.js';
import { PasswordSetupLinkResponseDto } from '../dto/password-setup-link-response.dto.js';
import {
  accessStatusWhere,
  toPlatformShopResponse,
  trialShopsCountSql,
} from '../helpers/platform-shop-access.helper.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { StoreService } from '../../store/services/store.service.js';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import {
  storeSlugBase,
  nextFreeStoreSlug,
} from '../../store/helpers/store-slug.helper.js';

@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly storeService: StoreService,
    private readonly storefrontRevalidate: StorefrontRevalidateService,
  ) {}

  async getOverview(): Promise<PlatformOverviewResponseDto> {
    const now = new Date();

    const [totalShops, activeShops, trialRows, expiredShops, suspendedShops] =
      await Promise.all([
        this.prisma.shop.count(),
        this.prisma.shop.count({
          where: {
            status: ShopStatus.ACTIVE,
            subscriptionEndsAt: { gt: now },
          },
        }),
        this.prisma.$queryRaw<Array<{ count: bigint }>>(
          trialShopsCountSql(now),
        ),
        this.prisma.shop.count({
          where: {
            status: ShopStatus.ACTIVE,
            subscriptionEndsAt: { lte: now },
          },
        }),
        this.prisma.shop.count({
          where: { status: ShopStatus.SUSPENDED },
        }),
      ]);

    const trialShops = Number(trialRows[0]?.count ?? 0);

    return {
      totalShops,
      activeShops,
      trialShops,
      expiredShops,
      suspendedShops,
    };
  }

  async listShops(
    query: ListShopsQueryDto,
  ): Promise<PaginatedResponseDTO<ResponsePlatformShopDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const now = new Date();

    const andParts: Prisma.ShopWhereInput[] = [];

    const accessStatuses = query.accessStatus ?? [];
    if (accessStatuses.length > 0) {
      const accessClauses = accessStatuses.map((status) =>
        accessStatusWhere(status, now),
      );
      andParts.push(
        accessClauses.length === 1 ? accessClauses[0] : { OR: accessClauses },
      );
    }

    andParts.push(
      ...buildTokenizedSearchAnd<Prisma.ShopWhereInput>(
        query.search,
        (token) => {
          const branches: Prisma.ShopWhereInput[] = [
            { name: { contains: token, mode: 'insensitive' } },
            { address: { contains: token, mode: 'insensitive' } },
            {
              users: {
                some: { name: { contains: token, mode: 'insensitive' } },
              },
            },
          ];
          for (const phone of phoneSearchVariants(token)) {
            branches.push({
              phone: { contains: phone, mode: 'insensitive' },
            });
            branches.push({
              users: {
                some: { phone: { contains: phone, mode: 'insensitive' } },
              },
            });
          }
          return branches;
        },
      ),
    );

    if (query.subscriptionFrom || query.subscriptionTo) {
      const from = query.subscriptionFrom ?? '1970-01-01';
      const to = query.subscriptionTo ?? '9999-12-31';
      andParts.push({ subscriptionEndsAt: dateColumnRange(from, to) });
    }

    if (query.createdFrom || query.createdTo) {
      const from = query.createdFrom ?? '1970-01-01';
      const to = query.createdTo ?? '9999-12-31';
      andParts.push({ createdAt: dateColumnRange(from, to) });
    }

    const where: Prisma.ShopWhereInput =
      andParts.length === 0
        ? {}
        : andParts.length === 1
          ? andParts[0]
          : { AND: andParts };

    const [rows, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              phone: true,
              passwordHash: true,
            },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          storeSettings: {
            select: { slug: true },
          },
        },
      }),
      this.prisma.shop.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponsePlatformShopDto>(
      rows.map((row) => toPlatformShopResponse(row, now)),
      total,
      page,
      pageSize,
    );
  }

  async createShop(dto: CreateShopDto): Promise<CreateShopResponseDto> {
    const ownerPhone = normalizePhone(dto.ownerPhone);

    if (!ownerPhone) {
      throw new BadRequestException(invalidOwnerPhone(dto.ownerPhone.trim()));
    }

    const subscriptionEndsAt = new Date(dto.subscriptionEndsAt);

    if (Number.isNaN(subscriptionEndsAt.getTime())) {
      throw new BadRequestException(invalidSubscriptionDate());
    }

    if (subscriptionEndsAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        subscriptionEndInPast(dto.subscriptionEndsAt),
      );
    }

    const phoneConflict = await findLoginPhoneConflict(this.prisma, ownerPhone);

    if (phoneConflict) {
      throw new BadRequestException(
        ownerPhoneAlreadyRegistered(dto.ownerPhone.trim()),
      );
    }

    const shopName = dto.shopName.trim();
    const ownerName = dto.ownerName.trim();
    const resolvedCity = resolveMarketplaceCityName(dto.city);
    if (!resolvedCity) {
      throw new BadRequestException(
        'Please select a valid KPK city from the list',
      );
    }
    const hub = findMarketplaceHub(resolvedCity);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const shop = await tx.shop.create({
          data: {
            name: shopName,
            phone: dto.shopPhone ? normalizePhoneOrRaw(dto.shopPhone) : null,
            address: dto.shopAddress?.trim() ?? null,
            status: ShopStatus.ACTIVE,
            subscriptionStatus: SubscriptionStatus.TRIALING,
            trialEndsAt: subscriptionEndsAt,
            subscriptionEndsAt,
          },
        });

        const owner = await tx.user.create({
          data: {
            shopId: shop.id,
            name: ownerName,
            phone: ownerPhone,

            passwordHash: null,
            role: 'OWNER',
          },
        });

        if (DEFAULT_CATEGORIES.length > 0) {
          await tx.category.createMany({
            data: DEFAULT_CATEGORIES.map((name) => ({ shopId: shop.id, name })),
          });
        }

        if (DEFAULT_BRANDS.length > 0) {
          await tx.brand.createMany({
            data: DEFAULT_BRANDS.map((name) => ({ shopId: shop.id, name })),
          });
        }

        if (DEFAULT_EXPENSE_CATEGORIES.length > 0) {
          await tx.expenseCategory.createMany({
            data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
              shopId: shop.id,
              name,
            })),
          });
        }

        await tx.supplier.create({
          data: {
            shopId: shop.id,
            name: WALK_IN_SUPPLIER.name,
            notes: WALK_IN_SUPPLIER.notes,
            isSystem: WALK_IN_SUPPLIER.isSystem,
          },
        });

        const storeSlug = await nextFreeStoreSlug(
          storeSlugBase(shop.name, shop.id),
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
            shopId: shop.id,
            slug: storeSlug,
            isEnabled: false,
            displayName: shop.name.trim().slice(0, 100),
            phoneNumber: shop.phone,
            address: shop.address,
            city: resolvedCity,
            latitude: hub?.latitude ?? null,
            longitude: hub?.longitude ?? null,
            mapPlaceName: resolvedCity,
          },
        });

        const link = await this.authService.buildSetupLink(owner.id, tx);

        return { shop, owner, link };
      });

      logInfo(
        'platform-admin.service.ts',
        'createShop',
        `Shop "${shopName}" onboarded with owner ${ownerPhone}`,
        {
          shopId: result.shop.id,
          ownerId: result.owner.id,
          subscriptionEndsAt: subscriptionEndsAt.toISOString(),
          setupLinkExpiresAt: result.link.expiresAt.toISOString(),
        },
      );

      this.storefrontRevalidate.invalidateStoresDirectory();

      return {
        shopId: result.shop.id,
        shopName: result.shop.name,
        ownerId: result.owner.id,
        ownerName: result.owner.name,
        ownerPhone: result.owner.phone,
        setupUrl: result.link.setupUrl,
        setupLinkExpiresAt: result.link.expiresAt,
        defaults: {
          categories: DEFAULT_CATEGORIES.length,
          brands: DEFAULT_BRANDS.length,
          expenseCategories: DEFAULT_EXPENSE_CATEGORIES.length,
          suppliers: 1,
        },
        counters: {
          nextSaleNo: result.shop.nextSaleNo,
          nextPurchaseNo: result.shop.nextPurchaseNo,
        },
        status: result.shop.status,
      };
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new BadRequestException(
          ownerPhoneAlreadyRegistered(dto.ownerPhone.trim()),
        );
      }
      throw error;
    }
  }

  async updateSubscription(
    shopId: string,
    dto: UpdateSubscriptionDto,
  ): Promise<UpdateSubscriptionResponseDto> {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });

    if (!shop) {
      throw new NotFoundException(resourceNotFound('Shop', shopId));
    }

    if (
      dto.subscriptionEndsAt === undefined &&
      dto.isActive === undefined &&
      dto.subscriptionStatus === undefined
    ) {
      throw new BadRequestException(
        'Nothing to update. Send subscriptionEndsAt to renew, or isActive to suspend / reactivate.',
      );
    }

    const data: {
      subscriptionEndsAt?: Date;
      status?: ShopStatus;
      subscriptionStatus?: SubscriptionStatus;
    } = {};

    if (dto.subscriptionStatus !== undefined) {
      data.subscriptionStatus = dto.subscriptionStatus;
    }

    if (dto.subscriptionEndsAt !== undefined) {
      const endsAt = new Date(dto.subscriptionEndsAt);

      if (Number.isNaN(endsAt.getTime())) {
        throw new BadRequestException(invalidSubscriptionDate());
      }

      if (endsAt.getTime() <= Date.now()) {
        throw new BadRequestException(
          subscriptionEndInPast(dto.subscriptionEndsAt),
        );
      }

      data.subscriptionEndsAt = endsAt;

      data.status =
        dto.isActive === false ? ShopStatus.SUSPENDED : ShopStatus.ACTIVE;
    }

    if (dto.isActive !== undefined && dto.subscriptionEndsAt === undefined) {
      data.status = dto.isActive ? ShopStatus.ACTIVE : ShopStatus.SUSPENDED;
    }

    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data,
    });

    await this.prisma.auditLog.create({
      data: {
        shopId: updated.id,
        action: 'SUBSCRIPTION_UPDATE',
        entityType: 'Shop',
        entityId: updated.id,
        metadata: {
          status: updated.status,
          subscriptionStatus: updated.subscriptionStatus,
          subscriptionEndsAt: updated.subscriptionEndsAt.toISOString(),
          isActive: dto.isActive,
        },
      },
    });

    logInfo(
      'platform-admin.service.ts',
      'updateSubscription',
      `Subscription updated for shop "${updated.name}"`,
      {
        shopId: updated.id,
        status: updated.status,
        subscriptionStatus: updated.subscriptionStatus,
        subscriptionEndsAt: updated.subscriptionEndsAt.toISOString(),
      },
    );

    return {
      shopId: updated.id,
      shopName: updated.name,
      status: updated.status,
      subscriptionStatus: updated.subscriptionStatus,
      trialEndsAt: updated.trialEndsAt,
      subscriptionEndsAt: updated.subscriptionEndsAt,
      isAccessible:
        updated.status === ShopStatus.ACTIVE &&
        updated.subscriptionEndsAt.getTime() > Date.now(),
    };
  }

  async changeStoreSlug(
    shopId: string,
    dto: ChangeStoreSlugDto,
  ): Promise<StatusBaseResponseDTO> {
    return this.storeService.changeStoreSlug(shopId, dto.slug);
  }

  async getShopOwner(shopId: string): Promise<ShopOwnerStatusResponseDto> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        users: {
          select: {
            name: true,
            phone: true,
            passwordHash: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(resourceNotFound('Shop', shopId));
    }

    if (shop.users.length > 1) {
      throw new BadRequestException(oneOwnerPerShop(shop.name));
    }

    const owner = shop.users[0];

    return {
      shopId: shop.id,
      hasOwner: Boolean(owner),
      ownerName: owner?.name ?? null,
      ownerPhone: owner?.phone ?? null,
      hasPassword: Boolean(owner?.passwordHash),
    };
  }

  async issuePasswordSetupLink(
    shopId: string,
  ): Promise<PasswordSetupLinkResponseDto> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        users: {
          select: { id: true, name: true, phone: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(resourceNotFound('Shop', shopId));
    }

    if (shop.users.length > 1) {
      throw new BadRequestException(oneOwnerPerShop(shop.name));
    }

    const owner = shop.users[0];
    if (!owner) {
      throw new BadRequestException(resourceNotFound('Owner', shopId));
    }

    const link = await this.authService.buildSetupLink(owner.id);

    logInfo(
      'platform-admin.service.ts',
      'issuePasswordSetupLink',
      `Password setup link issued for shop "${shop.name}"`,
      { shopId: shop.id, ownerId: owner.id },
    );

    return {
      shopId: shop.id,
      ownerId: owner.id,
      ownerName: owner.name,
      ownerPhone: owner.phone,
      setupUrl: link.setupUrl,
      setupLinkExpiresAt: link.expiresAt,
    };
  }

  async setShopActive(
    shopId: string,
    isActive: boolean,
  ): Promise<UpdateSubscriptionResponseDto> {
    return this.updateSubscription(shopId, { isActive });
  }
}
