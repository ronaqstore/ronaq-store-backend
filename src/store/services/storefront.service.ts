import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ShopStatus } from '../../generated/prisma/enums.js';
import {
  ResponseStoreDto,
  ResponseStoreProductDto,
  ResponseStoreCategoriesDto,
  ResponseStoreListItemDto,
  StoreFilterOptionDto,
  StoreAvailability,
} from '../dto/response-storefront.dto.js';
import { StoreProductsQueryDto } from '../dto/store-products-query.dto.js';
import { StoreListQueryDto } from '../dto/store-list-query.dto.js';
import type {
  StorefrontCatalogSettings,
  StorefrontSettingsProfile,
} from './storefront.service.types.js';
import { StoreCacheService } from './store-cache.service.js';
import {
  resourceNotFound,
  storeNotAvailable,
} from '../../errors/error.builder.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';

const SELLABLE_STATUS = 'IN_STOCK';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StorefrontProductRow = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true } };
    brand: { select: { id: true; name: true } };
    stockLevel: { select: { quantityOnHand: true } };
    _count: {
      select: { inventoryUnits: { where: { status: typeof SELLABLE_STATUS } } };
    };
    images: { select: { url: true; sortOrder: true } };
  };
}>;

const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  stockLevel: { select: { quantityOnHand: true } },
  _count: {
    select: { inventoryUnits: { where: { status: SELLABLE_STATUS } } },
  },
  images: {
    select: { url: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

function availability(
  quantityOnHand: number,
  lowStockThreshold: number,
): StoreAvailability {
  if (quantityOnHand <= 0) return 'OUT_OF_STOCK';
  if (quantityOnHand <= lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: StoreCacheService,
  ) {}

  async getStores(
    query: StoreListQueryDto,
  ): Promise<PaginatedResponseDTO<ResponseStoreListItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = getSkipNumber(page, limit);

    const where: Prisma.ShopStoreSettingsWhereInput = {
      isEnabled: true,
      shop: {
        status: ShopStatus.ACTIVE,
      },
    };

    if (query.city) {
      where.city = { contains: query.city, mode: 'insensitive' };
    }

    if (query.q) {
      where.OR = [
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { about: { contains: query.q, mode: 'insensitive' } },
        { shop: { name: { contains: query.q, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.shopStoreSettings.count({ where }),
      this.prisma.shopStoreSettings.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          shop: {
            select: {
              _count: {
                select: {
                  products: {
                    where: { isPublished: true, isActive: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const items: ResponseStoreListItemDto[] = rows.map((r) => ({
      ...this.toProfile(r),
      totalProducts: r.shop?._count?.products ?? 0,
    }));

    return new PaginatedResponseDTO(items, total, page, limit);
  }

  async getStore(slug: string): Promise<ResponseStoreDto> {
    const settings = await this.resolvePublicStore(slug);
    return this.toProfile(settings);
  }

  async getCategories(slug: string): Promise<ResponseStoreCategoriesDto> {
    const settings = await this.resolvePublicStore(slug);
    return this.buildCategories(settings.shopId);
  }

  async getProducts(
    slug: string,
    query: StoreProductsQueryDto,
  ): Promise<PaginatedResponseDTO<ResponseStoreProductDto>> {
    const settings = await this.resolvePublicStore(slug);
    return this.buildProducts(settings, query);
  }

  async getProduct(
    slug: string,
    productId: string,
  ): Promise<ResponseStoreProductDto> {
    const settings = await this.resolvePublicStore(slug);
    return this.buildProduct(settings, productId);
  }

  async getPreviewStore(shopId: string): Promise<ResponseStoreDto> {
    const settings = await this.resolvePreviewStore(shopId);
    return this.toProfile(settings);
  }

  async getPreviewCategories(
    shopId: string,
  ): Promise<ResponseStoreCategoriesDto> {
    await this.resolvePreviewStore(shopId);
    return this.buildCategories(shopId);
  }

  async getPreviewProducts(
    shopId: string,
    query: StoreProductsQueryDto,
  ): Promise<PaginatedResponseDTO<ResponseStoreProductDto>> {
    const settings = await this.resolvePreviewStore(shopId);
    return this.buildProducts(settings, query);
  }

  async getPreviewProduct(
    shopId: string,
    productId: string,
  ): Promise<ResponseStoreProductDto> {
    const settings = await this.resolvePreviewStore(shopId);
    return this.buildProduct(settings, productId);
  }

  private async resolvePublicStore(slug: string) {
    let settings = this.cache.get(slug);
    if (!settings) {
      settings =
        (await this.prisma.shopStoreSettings.findUnique({ where: { slug } })) ??
        undefined;
      if (settings) this.cache.set(slug, settings);
    }
    if (!settings || !settings.isEnabled) {
      throw new NotFoundException(storeNotAvailable());
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: settings.shopId },
      select: { status: true },
    });
    if (!shop || shop.status !== ShopStatus.ACTIVE) {
      throw new NotFoundException(storeNotAvailable());
    }
    return settings;
  }

  private async resolvePreviewStore(shopId: string) {
    const settings = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
    });
    if (!settings) {
      throw new NotFoundException(resourceNotFound('Store settings'));
    }
    return settings;
  }

  private toProfile(settings: StorefrontSettingsProfile): ResponseStoreDto {
    return {
      id: settings.id,
      slug: settings.slug,
      displayName: settings.displayName,
      about: settings.about,
      logoUrl: settings.logoUrl,
      bannerUrl: settings.bannerUrl,
      whatsappNumber: settings.whatsappNumber,
      phoneNumber: settings.phoneNumber,
      address: settings.address,
      city: settings.city,
      googleMapsUrl: settings.googleMapsUrl,
      openingHours: settings.openingHours,
      facebookUrl: settings.facebookUrl,
      instagramUrl: settings.instagramUrl,
    };
  }

  private catalogWhere(
    shopId: string,
    query?: Pick<StoreProductsQueryDto, 'q' | 'category' | 'brand' | 'inStock'>,
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      shopId,
      isActive: true,
      isPublished: true,
      publishedAt: { not: null },
    };
    if (query?.q) {
      const term = query.q;
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { brand: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (query?.category) {
      where.category = UUID_RE.test(query.category)
        ? { id: query.category }
        : { name: { equals: query.category, mode: 'insensitive' } };
    }
    if (query?.brand) {
      where.brand = UUID_RE.test(query.brand)
        ? { id: query.brand }
        : { name: { equals: query.brand, mode: 'insensitive' } };
    }
    if (query?.inStock === true) {
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        {
          OR: [
            {
              trackingType: 'QUANTITY',
              stockLevel: { quantityOnHand: { gt: 0 } },
            },
            {
              trackingType: 'SERIALIZED',
              inventoryUnits: { some: { status: SELLABLE_STATUS } },
            },
          ],
        },
      ];
    }
    return where;
  }

  private async buildProducts(
    settings: StorefrontCatalogSettings,
    query: StoreProductsQueryDto,
  ): Promise<PaginatedResponseDTO<ResponseStoreProductDto>> {
    const { page, pageSize } = normalizePagination(query.page, query.limit, 50);
    const where = this.catalogWhere(settings.shopId, query);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    const items = rows.map((row: StorefrontProductRow) =>
      this.toProduct(row, settings.showExactStock),
    );
    return new PaginatedResponseDTO(items, total, page, pageSize);
  }

  private async buildProduct(
    settings: StorefrontCatalogSettings,
    productId: string,
  ): Promise<ResponseStoreProductDto> {
    const row = await this.prisma.product.findFirst({
      where: { ...this.catalogWhere(settings.shopId), id: productId },
      include: PRODUCT_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(resourceNotFound('Product', productId));
    }
    return this.toProduct(row, settings.showExactStock);
  }

  private async buildCategories(
    shopId: string,
  ): Promise<ResponseStoreCategoriesDto> {
    const where = this.catalogWhere(shopId);
    const [categoryRows, brandRows] = await Promise.all([
      this.prisma.product.findMany({
        where,
        distinct: ['categoryId'],
        select: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.product.findMany({
        where,
        distinct: ['brandId'],
        select: { brand: { select: { id: true, name: true } } },
      }),
    ]);

    const byName = (a: StoreFilterOptionDto, b: StoreFilterOptionDto): number =>
      a.name.localeCompare(b.name);

    const categories = categoryRows.map((r) => r.category).sort(byName);
    const brands = brandRows.map((r) => r.brand).sort(byName);
    return { categories, brands };
  }

  private toProduct(
    row: StorefrontProductRow,
    showExactStock: boolean,
  ): ResponseStoreProductDto {
    const quantityOnHand =
      row.trackingType === 'QUANTITY'
        ? (row.stockLevel?.quantityOnHand ?? 0)
        : row._count.inventoryUnits;

    return {
      id: row.id,
      name: row.name,
      brand: row.brand.name,
      category: row.category.name,
      price: row.contactForPrice ? null : Number(row.defaultSellingPrice),
      contactForPrice: row.contactForPrice,
      availability: availability(quantityOnHand, row.lowStockThreshold),
      stockCount: showExactStock ? quantityOnHand : null,
      ptaStatus: row.ptaStatus,
      images: [...row.images]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => image.url),
      description: row.publicDescription,
      specs: {
        model: row.model ?? null,
        color: row.color ?? null,
        ram: row.ram ?? null,
        storage: row.storage ?? null,
      },
    };
  }
}
