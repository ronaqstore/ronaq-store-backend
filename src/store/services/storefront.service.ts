import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ShopStatus } from '../../generated/prisma/enums.js';
import {
  ResponseStoreDto,
  ResponseStoreProductDto,
  ResponseStoreCategoriesDto,
  ResponseStoreListItemDto,
  ResponseStoreModelDto,
  ResponseStoreModelDetailDto,
  ResponseStoreUnitDto,
  StoreFilterOptionDto,
  StoreAvailability,
} from '../dto/response-storefront.dto.js';
import { StoreProductsQueryDto } from '../dto/store-products-query.dto.js';
import { StoreListQueryDto } from '../dto/store-list-query.dto.js';
import type { StorefrontCatalogSettings } from './storefront.service.types.js';
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
import {
  parseModelKey,
  slugify,
  toModelKey,
} from '../../helpers/slug.helper.js';
import {
  STOREFRONT_PRODUCT_INCLUDE,
  STOREFRONT_SELLABLE_STATUS,
  applyUnitConditionSummary,
  applyUnitMinPrice,
  mapStorefrontUnitRow,
  storefrontCatalogWhere,
  toStorefrontProduct,
  toStorefrontProfile,
  type StorefrontProductRow,
} from '../helpers/storefront.mapper.js';
import { resolveHubCityFilter } from '../helpers/marketplace-hub.helper.js';

@Injectable()
export class StorefrontService {
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
      const cityFilter = resolveHubCityFilter(query.city);
      if (cityFilter) {
        where.city = { equals: cityFilter, mode: 'insensitive' };
      }
    }

    if (query.q) {
      where.OR = [
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
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
      ...toStorefrontProfile(r),
      totalProducts: r.shop?._count?.products ?? 0,
    }));

    return new PaginatedResponseDTO(items, total, page, limit);
  }

  async getStore(slug: string): Promise<ResponseStoreDto> {
    const settings = await this.resolvePublicStore(slug);
    return toStorefrontProfile(settings);
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

  async getModels(slug: string): Promise<ResponseStoreModelDto[]> {
    const settings = await this.resolvePublicStore(slug);
    return this.buildModels(settings);
  }

  async getModel(
    slug: string,
    modelKey: string,
  ): Promise<ResponseStoreModelDetailDto> {
    const settings = await this.resolvePublicStore(slug);
    return this.buildModel(settings, modelKey);
  }

  async getPreviewStore(shopId: string): Promise<ResponseStoreDto> {
    const settings = await this.resolvePreviewStore(shopId);
    return toStorefrontProfile(settings);
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

  private async buildProducts(
    settings: StorefrontCatalogSettings,
    query: StoreProductsQueryDto,
  ): Promise<PaginatedResponseDTO<ResponseStoreProductDto>> {
    const { page, pageSize } = normalizePagination(query.page, query.limit, 50);
    const where = storefrontCatalogWhere(settings.shopId, query);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        include: STOREFRONT_PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    const items = rows.map((row: StorefrontProductRow) =>
      toStorefrontProduct(row, settings.showExactStock),
    );
    return new PaginatedResponseDTO(items, total, page, pageSize);
  }

  private async buildProduct(
    settings: StorefrontCatalogSettings,
    productId: string,
  ): Promise<ResponseStoreProductDto> {
    const row = await this.prisma.product.findFirst({
      where: { ...storefrontCatalogWhere(settings.shopId), id: productId },
      include: STOREFRONT_PRODUCT_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(resourceNotFound('Product', productId));
    }
    const product = toStorefrontProduct(row, settings.showExactStock);
    if (row.trackingType === 'SERIALIZED') {
      const unitsByProduct = await this.loadStoreUnitsForProducts(
        settings.shopId,
        [row],
      );
      product.units = unitsByProduct.get(row.id) ?? [];
      applyUnitMinPrice(product);
      applyUnitConditionSummary(product);
    }
    return product;
  }

  private async buildCategories(
    shopId: string,
  ): Promise<ResponseStoreCategoriesDto> {
    const where = storefrontCatalogWhere(shopId);
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

  private async buildModels(
    settings: StorefrontCatalogSettings,
  ): Promise<ResponseStoreModelDto[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        ...storefrontCatalogWhere(settings.shopId),
        trackingType: 'SERIALIZED',
      },
      include: STOREFRONT_PRODUCT_INCLUDE,
      orderBy: [{ brand: { name: 'asc' } }, { model: 'asc' }, { name: 'asc' }],
    });

    type Acc = {
      key: string;
      brand: string;
      model: string;
      variantCount: number;
      coverImage: string | null;
      fromPrice: number | null;
      availability: StoreAvailability;
    };

    const rank: Record<StoreAvailability, number> = {
      IN_STOCK: 3,
      LOW_STOCK: 2,
      OUT_OF_STOCK: 1,
    };

    const byKey = new Map<string, Acc>();
    for (const row of rows) {
      const modelLabel = (row.model?.trim() || row.name).trim();
      const key = toModelKey(row.brand.name, modelLabel);
      const product = toStorefrontProduct(row, settings.showExactStock);
      const cover = product.images[0] ?? null;
      const price = product.price;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          key,
          brand: row.brand.name,
          model: modelLabel,
          variantCount: 1,
          coverImage: cover,
          fromPrice: price,
          availability: product.availability,
        });
        continue;
      }
      existing.variantCount += 1;
      if (!existing.coverImage && cover) existing.coverImage = cover;
      if (price != null) {
        existing.fromPrice =
          existing.fromPrice == null
            ? price
            : Math.min(existing.fromPrice, price);
      }
      if (rank[product.availability] > rank[existing.availability]) {
        existing.availability = product.availability;
      }
    }

    return [...byKey.values()].sort((a, b) => {
      const brandCmp = a.brand.localeCompare(b.brand);
      if (brandCmp !== 0) return brandCmp;
      return a.model.localeCompare(b.model);
    });
  }

  private async buildModel(
    settings: StorefrontCatalogSettings,
    modelKey: string,
  ): Promise<ResponseStoreModelDetailDto> {
    const parsed = parseModelKey(modelKey);
    if (!parsed) {
      throw new NotFoundException(resourceNotFound('Model', modelKey));
    }

    const rows = await this.prisma.product.findMany({
      where: {
        ...storefrontCatalogWhere(settings.shopId),
        trackingType: 'SERIALIZED',
      },
      include: STOREFRONT_PRODUCT_INCLUDE,
      orderBy: [{ color: 'asc' }, { storage: 'asc' }, { name: 'asc' }],
    });

    const variants = rows.filter((row) => {
      const modelLabel = (row.model?.trim() || row.name).trim();
      return (
        slugify(row.brand.name) === parsed.brandSlug &&
        slugify(modelLabel) === parsed.modelSlug
      );
    });

    if (variants.length === 0) {
      throw new NotFoundException(resourceNotFound('Model', modelKey));
    }

    const first = variants[0];
    const modelLabel = (first.model?.trim() || first.name).trim();
    const unitsByProduct = await this.loadStoreUnitsForProducts(
      settings.shopId,
      variants,
    );

    return {
      key: toModelKey(first.brand.name, modelLabel),
      brand: first.brand.name,
      model: modelLabel,
      variants: variants.map((row) => {
        const product = toStorefrontProduct(row, settings.showExactStock);
        product.units = unitsByProduct.get(row.id) ?? [];
        applyUnitMinPrice(product);
        applyUnitConditionSummary(product);
        return product;
      }),
    };
  }

  private async loadStoreUnitsForProducts(
    shopId: string,
    products: StorefrontProductRow[],
  ): Promise<Map<string, ResponseStoreUnitDto[]>> {
    const ids = products.map((p) => p.id);
    if (ids.length === 0) return new Map();

    const defaults = new Map(
      products.map((p) => [p.id, Number(p.defaultSellingPrice)]),
    );

    const rows = await this.prisma.inventoryUnit.findMany({
      where: {
        shopId,
        productId: { in: ids },
        status: STOREFRONT_SELLABLE_STATUS,
      },
      orderBy: [
        { condition: 'asc' },
        { batteryHealth: 'desc' },
        { createdAt: 'asc' },
      ],
      select: {
        id: true,
        productId: true,
        imei1: true,
        condition: true,
        batteryHealth: true,
        askingPrice: true,
        defectNotes: true,
      },
    });

    const map = new Map<string, ResponseStoreUnitDto[]>();
    for (const row of rows) {
      const meta = defaults.get(row.productId);
      const list = map.get(row.productId) ?? [];
      list.push(
        mapStorefrontUnitRow({
          id: row.id,
          imei1: row.imei1,
          condition: row.condition,
          batteryHealth: row.batteryHealth,
          askingPrice: row.askingPrice,
          defectNotes: row.defectNotes,
          defaultPrice: meta ?? 0,
        }),
      );
      map.set(row.productId, list);
    }
    return map;
  }
}
