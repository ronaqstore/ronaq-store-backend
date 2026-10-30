import type { Prisma } from '../../generated/prisma/client.js';
import {
  DEFAULT_BRANDS,
  DEFAULT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  WALK_IN_SUPPLIER,
} from '../constants/default-lists.constant.js';
import {
  nextFreeStoreSlug,
  storeSlugBase,
} from '../../store/helpers/store-slug.helper.js';

type MarketplaceHubCoords = {
  latitude: number;
  longitude: number;
};

type ShopSeedTarget = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

export async function seedNewShopDefaults(
  tx: Prisma.TransactionClient,
  shop: ShopSeedTarget,
  resolvedCity: string,
  hub: MarketplaceHubCoords | null | undefined,
): Promise<string> {
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

  return storeSlug;
}
