import type {
  ShopStatus,
  SubscriptionStatus,
} from '../../generated/prisma/enums.js';

export type PlatformShopListRow = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: ShopStatus;
  subscriptionStatus?: SubscriptionStatus;
  trialEndsAt?: Date | null;
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
