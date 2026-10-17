import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { resourceNotFound } from '../errors/error.builder.js';

type DbClient = PrismaService | Prisma.TransactionClient;

export type ShopProductRef = {
  id: string;
  name: string;
  trackingType: string;
};

export async function loadShopProductsById(
  client: DbClient,
  productIds: string[],
  shopId: string,
): Promise<Map<string, ShopProductRef>> {
  const uniqueIds = [...new Set(productIds)];
  const products = await client.product.findMany({
    where: { id: { in: uniqueIds }, shopId },
    select: { id: true, name: true, trackingType: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const missing = uniqueIds.find((id) => !byId.has(id));
  if (missing) {
    throw new NotFoundException(resourceNotFound('Product', missing));
  }

  return byId;
}
