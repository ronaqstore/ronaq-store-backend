import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { duplicateProductVariant } from '../../errors/error.builder.js';

export type ProductVariantFingerprint = {
  name: string;
  model: string | null;
  color: string | null;
  ram: string | null;
  storage: string | null;
  ptaStatus: string | null;
  authenticity: string | null;
};

export async function assertNoDuplicateVariant(
  prisma: PrismaService,
  shopId: string,
  variant: ProductVariantFingerprint,
  excludeProductId?: string,
): Promise<void> {
  const where: Prisma.ProductWhereInput = {
    shopId,
    name: { equals: variant.name, mode: 'insensitive' },
    model: variant.model,
    color: variant.color,
    ram: variant.ram,
    storage: variant.storage,
    ptaStatus: (variant.ptaStatus ?? null) as never,
    authenticity: (variant.authenticity ?? null) as never,
  };
  if (excludeProductId) {
    where.id = { not: excludeProductId };
  }

  const clash = await prisma.product.findFirst({
    where,
    select: { id: true },
  });
  if (clash) {
    throw new BadRequestException(duplicateProductVariant(variant.name));
  }
}
