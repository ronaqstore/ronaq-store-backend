import type { UserRole } from '../generated/prisma/enums.js';

export type OwnerAuthUserSlice = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  shopId: string;
};

export type OwnerAuthShopSlice = {
  name: string;
  subscriptionEndsAt: Date;
};

export function buildOwnerAuthResponseBody(
  accessToken: string,
  expiresIn: string,
  user: OwnerAuthUserSlice,
  shop: OwnerAuthShopSlice,
) {
  return {
    accessToken,
    tokenType: 'Bearer' as const,
    expiresIn,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
    shopId: user.shopId,
    shop: {
      name: shop.name,
      subscriptionEndsAt: shop.subscriptionEndsAt,
    },
  };
}
