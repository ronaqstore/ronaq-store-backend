import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UpdateStoreSettingsDto } from '../dto/update-store-settings.dto.js';
import { ReorderProductImagesDto } from '../dto/reorder-product-images.dto.js';
import { ResponseProductImageDto } from '../dto/response-product-image.dto.js';
import type { UploadedImageFile } from '../dto/uploaded-image-file.type.js';
import { ResponseStoreSettingsDto } from '../dto/response-store-settings.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import type { ExistingStoreSettingsWhatsapp } from './store.service.types.js';
import { StoreCacheService } from './store-cache.service.js';
import { StorefrontRevalidateService } from './storefront-revalidate.service.js';
import { R2StorageService } from './r2-storage.service.js';
import {
  resourceNotFound,
  duplicateFieldValue,
  requiredFieldCannotBeNull,
  slugReserved,
  productNotPublishable,
  imageLimitExceeded,
  reorderImageMismatch,
} from '../../errors/error.builder.js';
import {
  isUniqueConstraintViolation,
  violatedColumn,
} from '../../helpers/prisma-error-helper.js';
import { toLocalPkPhone } from '../../helpers/phone.helper.js';
import {
  RESERVED_SLUGS,
  storeSlugBase,
  nextFreeStoreSlug,
} from '../helpers/store-slug.helper.js';
import { normalizeAndAssertContactPhone } from '../helpers/store-contact-phone.helper.js';
import { normalizeLocationCoords } from '../helpers/store-location.helper.js';
import { buildStoreSettingsUpdate } from '../helpers/store-settings-update.helper.js';
import { processStoreImage } from '../helpers/store-image-process.helper.js';
import { resolveMarketplaceCityName } from '../helpers/marketplace-hub.helper.js';

const MAX_PRODUCT_IMAGES = 5;
const MAX_IMAGE_EDGE = 1600;

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: StoreCacheService,
    private readonly r2: R2StorageService,
    private readonly storefrontRevalidate: StorefrontRevalidateService,
  ) {}

  async getSettings(shopId: string): Promise<ResponseStoreSettingsDto> {
    const settings = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
    });
    if (!settings) {
      throw new NotFoundException(resourceNotFound('Store settings'));
    }
    return {
      ...settings,
      phoneNumber: toLocalPkPhone(settings.phoneNumber) ?? settings.phoneNumber,
      whatsappNumber:
        toLocalPkPhone(settings.whatsappNumber) ?? settings.whatsappNumber,
    };
  }

  async updateSettings(
    dto: UpdateStoreSettingsDto,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    if (dto.displayName === null) {
      throw new BadRequestException(
        requiredFieldCannotBeNull('Store settings', 'displayName'),
      );
    }

    if (dto.phoneNumber !== undefined) {
      dto.phoneNumber = await normalizeAndAssertContactPhone(
        this.prisma,
        dto.phoneNumber,
        shopId,
      );
    }
    if (dto.whatsappNumber !== undefined) {
      dto.whatsappNumber = await normalizeAndAssertContactPhone(
        this.prisma,
        dto.whatsappNumber,
        shopId,
      );
    }

    normalizeLocationCoords(dto);

    if (dto.city !== undefined && dto.city !== null && dto.city.trim()) {
      const resolvedCity = resolveMarketplaceCityName(dto.city);
      if (!resolvedCity) {
        throw new BadRequestException(
          'Please select a valid KPK city from the list',
        );
      }
      dto.city = resolvedCity;
    }

    const existing = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
    });

    let createSlug: string | undefined;
    try {
      if (existing) {
        await this.prisma.shopStoreSettings.update({
          where: { shopId },
          data: buildStoreSettingsUpdate(dto),
        });
      } else {
        createSlug = await this.nextFreeSlug(shopId);
        const createData = buildStoreSettingsUpdate(dto);
        if (createData.address === undefined) {
          const shop = await this.prisma.shop.findUnique({
            where: { id: shopId },
            select: { address: true, name: true },
          });
          if (shop?.address?.trim()) {
            createData.address = shop.address.trim();
          }
        }
        await this.prisma.shopStoreSettings.create({
          data: {
            shopId,
            slug: createSlug,
            displayName:
              dto.displayName ?? (await this.shopDisplayName(shopId)),
            isEnabled: dto.isEnabled ?? false,
            showExactStock: dto.showExactStock ?? false,
            ...createData,
          },
        });
      }
    } catch (error) {
      if (isUniqueConstraintViolation(error) && violatedColumn(error, 'slug')) {
        throw new BadRequestException(
          duplicateFieldValue('Store', 'slug', createSlug ?? ''),
        );
      }
      throw error;
    }

    this.cache.clear();
    this.storefrontRevalidate.invalidateShopById(shopId);

    const verb = existing ? 'updated' : 'created';
    let message = `Store ${verb} successfully`;
    if (dto.isEnabled === true) {
      message += await this.enableWarningSuffix(dto, existing, shopId);
    }
    return new StatusBaseResponseDTO(true, message);
  }

  private async enableWarningSuffix(
    dto: UpdateStoreSettingsDto,
    existing: ExistingStoreSettingsWhatsapp | null,
    shopId: string,
  ): Promise<string> {
    const warnings: string[] = [];

    const whatsapp =
      dto.whatsappNumber !== undefined
        ? dto.whatsappNumber?.trim() || null
        : (existing?.whatsappNumber ?? null);
    if (!whatsapp) warnings.push('no WhatsApp number is set');

    const published = await this.prisma.product.count({
      where: {
        shopId,
        isActive: true,
        isPublished: true,
        publishedAt: { not: null },
      },
    });
    if (published === 0) warnings.push('no product is published yet');

    if (warnings.length === 0) return '';
    return `. Warning: ${warnings.join('; ')}.`;
  }

  async changeStoreSlug(
    shopId: string,
    slug: string,
  ): Promise<StatusBaseResponseDTO> {
    const normalized = slug.trim().toLowerCase();
    if (RESERVED_SLUGS.has(normalized)) {
      throw new BadRequestException(slugReserved(normalized));
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true },
    });
    if (!shop) {
      throw new NotFoundException(resourceNotFound('Shop', shopId));
    }
    const settings = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
      select: { slug: true },
    });
    if (!settings) {
      throw new NotFoundException(resourceNotFound('Store settings'));
    }
    if (settings.slug === normalized) {
      return new StatusBaseResponseDTO(
        true,
        `Store slug updated to "${normalized}"`,
      );
    }

    try {
      await this.prisma.shopStoreSettings.update({
        where: { shopId },
        data: { slug: normalized },
      });

      await this.prisma.auditLog.create({
        data: {
          shopId,
          action: 'STORE_SLUG_CHANGE',
          entityType: 'ShopStoreSettings',
          entityId: shopId,
          metadata: {
            oldSlug: settings.slug,
            newSlug: normalized,
          },
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error) && violatedColumn(error, 'slug')) {
        throw new BadRequestException(
          duplicateFieldValue('Store', 'slug', normalized),
        );
      }
      throw error;
    }

    this.cache.clear();
    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(
      true,
      `Store slug updated to "${normalized}"`,
    );
  }

  async publishProduct(
    productId: string,
    shopId: string,
  ): Promise<StatusBaseResponseDTO> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId },
      select: { isActive: true, name: true },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', productId));
    }
    if (!product.isActive) {
      throw new BadRequestException(productNotPublishable(product.name));
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { isPublished: true },
    });
    return new StatusBaseResponseDTO(true, 'Product published successfully');
  }

  async unpublishProduct(
    productId: string,
    shopId: string,
  ): Promise<StatusBaseResponseDTO> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', productId));
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { isPublished: false },
    });
    return new StatusBaseResponseDTO(true, 'Product unpublished successfully');
  }

  async addProductImage(
    productId: string,
    file: UploadedImageFile,
    shopId: string,
  ): Promise<StatusBaseResponseDTO> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId },
      select: { name: true },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', productId));
    }

    const count = await this.prisma.productImage.count({
      where: { productId, shopId },
    });
    if (count >= MAX_PRODUCT_IMAGES) {
      throw new BadRequestException(
        imageLimitExceeded(product.name, MAX_PRODUCT_IMAGES),
      );
    }

    const processed = await processStoreImage(file, {
      maxEdge: MAX_IMAGE_EDGE,
      fit: 'inside',
    });
    const key = `products-images/${shopId}/${productId}/${randomUUID()}.${processed.ext}`;
    const url = await this.r2.put(key, processed.buffer, processed.contentType);

    try {
      const last = await this.prisma.productImage.findFirst({
        where: { productId, shopId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      const sortOrder = (last?.sortOrder ?? -1) + 1;

      await this.prisma.productImage.create({
        data: { shopId, productId, url, sortOrder },
      });
      await this.syncProductCoverImage(productId, shopId);
    } catch (error) {
      await this.r2.deleteByUrl(url);
      throw error;
    }
    return new StatusBaseResponseDTO(true, 'Product image added successfully');
  }

  async listProductImages(
    productId: string,
    shopId: string,
  ): Promise<ResponseProductImageDto[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', productId));
    }
    return this.prisma.productImage.findMany({
      where: { productId, shopId },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        url: true,
        sortOrder: true,
      },
    });
  }

  async reorderProductImages(
    productId: string,
    dto: ReorderProductImagesDto,
    shopId: string,
  ): Promise<StatusBaseResponseDTO> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, shopId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', productId));
    }

    const images = await this.prisma.productImage.findMany({
      where: { productId, shopId },
      select: { id: true },
    });
    const existingIds = images.map((i) => i.id).sort();
    const sentIds = [...dto.imageIds].sort();
    if (
      existingIds.length !== sentIds.length ||
      existingIds.some((id, i) => id !== sentIds[i])
    ) {
      throw new BadRequestException(reorderImageMismatch());
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [index, imageId] of dto.imageIds.entries()) {
        await tx.productImage.update({
          where: { id: imageId },
          data: { sortOrder: index },
        });
      }
    });
    await this.syncProductCoverImage(productId, shopId);
    return new StatusBaseResponseDTO(
      true,
      'Product images reordered successfully',
    );
  }

  async removeProductImage(
    productId: string,
    imageId: string,
    shopId: string,
  ): Promise<StatusBaseResponseDTO> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId, shopId },
    });
    if (!image) {
      throw new NotFoundException(resourceNotFound('Product image', imageId));
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });
    await this.syncProductCoverImage(productId, shopId);

    await this.r2.deleteByUrl(image.url);
    return new StatusBaseResponseDTO(
      true,
      'Product image removed successfully',
    );
  }

  private async syncProductCoverImage(
    productId: string,
    shopId: string,
  ): Promise<void> {
    const cover = await this.prisma.productImage.findFirst({
      where: { productId, shopId },
      orderBy: { sortOrder: 'asc' },
      select: { url: true },
    });
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrl: cover?.url ?? null },
    });
  }

  private async shopDisplayName(shopId: string): Promise<string> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true },
    });
    return shop?.name ?? '';
  }

  private async nextFreeSlug(shopId: string): Promise<string> {
    const base = storeSlugBase(await this.shopDisplayName(shopId), shopId);
    return nextFreeStoreSlug(base, async (candidate) =>
      Boolean(
        await this.prisma.shopStoreSettings.findUnique({
          where: { slug: candidate },
          select: { slug: true },
        }),
      ),
    );
  }
}
