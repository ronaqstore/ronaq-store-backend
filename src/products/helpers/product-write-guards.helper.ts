import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  duplicateFieldValue,
  duplicateProductVariant,
  ptaStatusNotAllowedForBrand,
  resourceNotFound,
  stockNotEmptyForTrackingChange,
  trackingTypeLocked,
} from '../../errors/error.builder.js';
import {
  isUniqueConstraintViolation,
  violatedColumn,
} from '../../helpers/prisma-error-helper.js';
import { isPtaAllowedForBrand } from '../../helpers/device-family.helper.js';

export async function assertCategoryOwned(
  prisma: PrismaService,
  categoryId: string,
  shopId: string,
): Promise<void> {
  const found = await prisma.category.findFirst({
    where: { id: categoryId, shopId, isActive: true },
    select: { id: true },
  });
  if (!found) {
    throw new NotFoundException(resourceNotFound('Category', categoryId));
  }
}

export async function assertBrandOwned(
  prisma: PrismaService,
  brandId: string,
  shopId: string,
): Promise<string> {
  const found = await prisma.brand.findFirst({
    where: { id: brandId, shopId, isActive: true },
    select: { id: true, name: true },
  });
  if (!found) {
    throw new NotFoundException(resourceNotFound('Brand', brandId));
  }
  return found.name;
}

export function assertPtaForBrand(
  brandName: string | null | undefined,
  ptaStatus: string | null | undefined,
  trackingType: string,
): void {
  if (trackingType !== 'SERIALIZED' || ptaStatus == null) return;
  if (!isPtaAllowedForBrand(brandName, ptaStatus)) {
    throw new BadRequestException(
      ptaStatusNotAllowedForBrand(brandName ?? 'this brand', ptaStatus),
    );
  }
}

export async function assertTrackingTypeChangeAllowed(
  prisma: PrismaService,
  productId: string,
  productName: string,
  nextType: 'QUANTITY' | 'SERIALIZED',
): Promise<void> {
  const [purchaseRefs, saleRefs] = await Promise.all([
    prisma.purchaseItem.count({ where: { productId } }),
    prisma.saleItem.count({ where: { productId } }),
  ]);
  if (purchaseRefs + saleRefs > 0) {
    throw new BadRequestException(trackingTypeLocked(productName));
  }

  if (nextType === 'SERIALIZED') {
    const level = await prisma.stockLevel.findUnique({
      where: { productId },
      select: { quantityOnHand: true },
    });
    if (level && level.quantityOnHand > 0) {
      throw new BadRequestException(
        stockNotEmptyForTrackingChange(productName, level.quantityOnHand),
      );
    }
  }
}

export function mapProductDuplicate(
  error: unknown,
  sku?: string | null,
  barcode?: string | null,
  name?: string,
): unknown {
  if (!isUniqueConstraintViolation(error)) return error;

  if (violatedColumn(error, 'variant')) {
    return new BadRequestException(duplicateProductVariant(name ?? 'Product'));
  }
  if (sku && violatedColumn(error, 'sku')) {
    return new BadRequestException(duplicateFieldValue('Product', 'SKU', sku));
  }
  if (barcode && violatedColumn(error, 'barcode')) {
    return new BadRequestException(
      duplicateFieldValue('Product', 'barcode', barcode),
    );
  }
  return error;
}
