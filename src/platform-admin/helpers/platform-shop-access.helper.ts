import { Prisma } from '../../generated/prisma/client.js';
import { ShopStatus } from '../../generated/prisma/enums.js';
import type { PlatformShopAccessStatus } from '../dto/list-shops-query.dto.js';
import type { ResponsePlatformShopDto } from '../dto/response-platform-shop.dto.js';
import type { PlatformShopListRow } from '../services/platform-admin.service.types.js';

export function deriveAccessStatus(
  status: ShopStatus,
  subscriptionEndsAt: Date,
  now: Date,
): PlatformShopAccessStatus {
  if (status === ShopStatus.SUSPENDED) return 'SUSPENDED';
  if (subscriptionEndsAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'ACTIVE';
}

export function accessStatusWhere(
  accessStatus: PlatformShopAccessStatus,
  now: Date,
): Prisma.ShopWhereInput {
  if (accessStatus === 'ACTIVE') {
    return {
      status: ShopStatus.ACTIVE,
      subscriptionEndsAt: { gt: now },
    };
  }
  if (accessStatus === 'EXPIRED') {
    return {
      status: ShopStatus.ACTIVE,
      subscriptionEndsAt: { lte: now },
    };
  }
  return { status: ShopStatus.SUSPENDED };
}

export function toPlatformShopResponse(
  shop: PlatformShopListRow,
  now: Date,
): ResponsePlatformShopDto {
  const owner = shop.users[0] ?? null;
  const accessStatus = deriveAccessStatus(
    shop.status,
    shop.subscriptionEndsAt,
    now,
  );

  return {
    id: shop.id,
    name: shop.name,
    phone: shop.phone,
    address: shop.address,
    status: shop.status,
    accessStatus,
    isAccessible:
      shop.status === ShopStatus.ACTIVE &&
      shop.subscriptionEndsAt.getTime() > now.getTime(),
    subscriptionEndsAt: shop.subscriptionEndsAt,
    ownerId: owner?.id ?? null,
    ownerName: owner?.name ?? null,
    ownerPhone: owner?.phone ?? null,
    hasPassword: Boolean(owner?.passwordHash),
    storeSlug: shop.storeSettings?.slug ?? null,
    createdAt: shop.createdAt,
  };
}

export function trialShopsCountSql(now: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM shops
    WHERE status = 'ACTIVE'
      AND subscription_ends_at > ${now}
      AND subscription_ends_at <= created_at + INTERVAL '30 days'
  `;
}
