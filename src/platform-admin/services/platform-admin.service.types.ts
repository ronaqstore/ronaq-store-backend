import type { ShopStatus } from '../../generated/prisma/enums.js';

export type PlatformShopListRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: ShopStatus;
  subscriptionEndsAt: Date;
  createdAt: Date;
  users: Array<{
    id: string;
    name: string;
    phone: string;
    passwordHash: string | null;
  }>;
  storeSettings: { slug: string } | null;
};
