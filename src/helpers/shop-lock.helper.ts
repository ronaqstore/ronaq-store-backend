import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { resourceNotFound } from '../errors/error.builder.js';

export async function lockShopForUpdate(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<void> {
  const shop = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE
  `;
  if (!shop?.length) {
    throw new NotFoundException(resourceNotFound('Shop', shopId));
  }
}
