import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ShopStatus } from '../../generated/prisma/enums.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  parseModelKey,
  slugify,
  toModelKey,
} from '../../helpers/slug.helper.js';
import { resourceNotFound } from '../../errors/error.builder.js';
import { storefrontCatalogWhere } from '../helpers/storefront.mapper.js';
import {
  nearestMarketplaceHub,
  paginateMarketplaceHubs,
  resolveHubCityTokens,
} from '../helpers/marketplace-hub.helper.js';
import {
  buildMarketplaceModelSearchSql,
  type MarketplaceModelSearchRow,
} from '../helpers/marketplace-model-search.helper.js';
import {
  buildMarketplaceProductSearchSql,
  canUseLeanProductSearch,
  type MarketplaceProductSearchRow,
} from '../helpers/marketplace-product-search.helper.js';
import {
  applyMarketplaceListingFilters,
  matchesModelKey,
  marketplaceShopWhere,
} from '../helpers/marketplace-filter.helper.js';
import {
  MARKETPLACE_PRODUCT_INCLUDE,
  toHubDto,
  toLeanMarketplaceProduct,
  toMarketplaceProduct,
} from '../helpers/marketplace-product.mapper.js';
import { MarketplaceSearchCacheService } from './marketplace-search-cache.service.js';
import {
  buildRelatedSearchTokens,
  isDeviceProduct,
  MARKETPLACE_ACCESSORY_CATEGORY_NAMES,
  scoreRelatedAccessory,
  type RelatedSourceProduct,
} from '../helpers/marketplace-related.helper.js';
import type { MarketplaceProductsQueryDto } from '../dto/marketplace-products-query.dto.js';
import type { MarketplaceHubsQueryDto } from '../dto/marketplace-hubs-query.dto.js';
import type { MarketplaceModelsQueryDto } from '../dto/marketplace-models-query.dto.js';
import type { MarketplaceRelatedQueryDto } from '../dto/marketplace-related-query.dto.js';
import type {
  ResponseMarketplaceHubDto,
  ResponseMarketplaceProductDto,
} from '../dto/response-marketplace.dto.js';
import type { ResponseMarketplaceModelDto } from '../dto/response-marketplace-model.dto.js';
import type { NearestHubQueryDto } from '../dto/nearest-hub-query.dto.js';

const MODEL_KEY_SCAN = 500;
const RELATED_CANDIDATE_SCAN = 120;

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchCache: MarketplaceSearchCacheService,
  ) {}

  listHubs(
    query: MarketplaceHubsQueryDto = {},
  ): PaginatedResponseDTO<ResponseMarketplaceHubDto> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.limit ?? 20,
      50,
    );
    const result = paginateMarketplaceHubs(query.q, page, pageSize);
    return new PaginatedResponseDTO(
      result.items.map((hub) => toHubDto(hub)),
      result.total,
      result.page,
      result.pageSize,
    );
  }

  resolveNearestHub(query: NearestHubQueryDto): ResponseMarketplaceHubDto {
    return toHubDto(nearestMarketplaceHub(query.latitude, query.longitude));
  }

  async searchModels(
    query: MarketplaceModelsQueryDto,
  ): Promise<{ items: ResponseMarketplaceModelDto[]; total: number }> {
    const q = query.q?.trim() ?? '';
    if (q.length < 2) {
      return { items: [], total: 0 };
    }

    const limit = Math.min(Math.max(query.limit ?? 8, 1), 20);
    const cacheKey = `models:${q.toLowerCase()}:${query.city ?? ''}:${limit}`;
    const cached = this.searchCache.get<{
      items: ResponseMarketplaceModelDto[];
      total: number;
    }>(cacheKey);
    if (cached) return cached;

    const sql = buildMarketplaceModelSearchSql(
      q,
      resolveHubCityTokens(query.city),
      limit,
    );
    if (!sql) {
      return { items: [], total: 0 };
    }

    const rows = await this.prisma.$queryRaw<MarketplaceModelSearchRow[]>(sql);
    const items: ResponseMarketplaceModelDto[] = rows.map((row) => {
      const brand = row.brand ?? '';
      const model = row.model ?? '';
      const minPriceRaw = row.min_price == null ? null : Number(row.min_price);
      return {
        modelKey: toModelKey(brand, model),
        brand,
        model,
        title: `${brand} ${model}`.trim(),
        count: Number(row.count) || 0,
        imageUrl: row.image_url ?? null,
        minPrice:
          minPriceRaw != null && Number.isFinite(minPriceRaw)
            ? minPriceRaw
            : null,
      };
    });

    const payload = { items, total: items.length };
    this.searchCache.set(cacheKey, payload);
    return payload;
  }

  async listProducts(
    query: MarketplaceProductsQueryDto,
  ): Promise<PaginatedResponseDTO<ResponseMarketplaceProductDto>> {
    const { page, pageSize } = normalizePagination(query.page, query.limit, 50);
    const cacheKey = `products:${JSON.stringify({
      q: query.q ?? '',
      city: query.city ?? '',
      modelKey: query.modelKey ?? '',
      category: query.category ?? '',
      brand: query.brand ?? '',
      inStock: query.inStock ?? '',
      condition: query.condition ?? '',
      minPrice: query.minPrice ?? '',
      maxPrice: query.maxPrice ?? '',
      pta: query.ptaStatus ?? '',
      authenticity: query.authenticity ?? '',
      sort: query.sort ?? '',
      page,
      pageSize,
    })}`;
    const cached =
      this.searchCache.get<PaginatedResponseDTO<ResponseMarketplaceProductDto>>(
        cacheKey,
      );
    if (cached) return cached;

    if (canUseLeanProductSearch(query)) {
      const lean = await this.listProductsLean(query, page, pageSize);
      this.searchCache.set(cacheKey, lean);
      return lean;
    }

    const parsedModel = query.modelKey ? parseModelKey(query.modelKey) : null;

    const catalogWhere = storefrontCatalogWhere(null, {
      q: parsedModel ? undefined : query.q,
      category: query.category,
      brand: query.brand,
      inStock: query.inStock,
    });

    const where: Prisma.ProductWhereInput = {
      ...catalogWhere,
      shop: marketplaceShopWhere(query.city),
    };
    const orderBy = applyMarketplaceListingFilters(where, query);

    if (parsedModel) {
      const brandHint = parsedModel.brandSlug.replace(/-/g, ' ');
      const modelWhere: Prisma.ProductWhereInput = {
        ...where,
        brand: {
          name: { contains: brandHint, mode: 'insensitive' },
        },
      };
      const rows = await this.prisma.product.findMany({
        where: modelWhere,
        take: MODEL_KEY_SCAN,
        orderBy,
        include: MARKETPLACE_PRODUCT_INCLUDE,
      });
      const matched = rows.filter((row) =>
        matchesModelKey(row, parsedModel.brandSlug, parsedModel.modelSlug),
      );
      const skip = getSkipNumber(page, pageSize);
      const pageRows = matched.slice(skip, skip + pageSize);
      const modelPage = new PaginatedResponseDTO(
        pageRows.map((row) => toMarketplaceProduct(row)),
        matched.length,
        page,
        pageSize,
      );
      this.searchCache.set(cacheKey, modelPage);
      return modelPage;
    }

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy,
        include: MARKETPLACE_PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    const browsePage = new PaginatedResponseDTO(
      rows.map((row) => toMarketplaceProduct(row)),
      total,
      page,
      pageSize,
    );
    this.searchCache.set(cacheKey, browsePage);
    return browsePage;
  }

  private async listProductsLean(
    query: MarketplaceProductsQueryDto,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResponseDTO<ResponseMarketplaceProductDto>> {
    const skip = getSkipNumber(page, pageSize);
    const sql = buildMarketplaceProductSearchSql({
      q: query.q ?? '',
      cityTokens: resolveHubCityTokens(query.city),
      category: query.category,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      ptaStatus: query.ptaStatus,
      authenticity: query.authenticity,
      sort: query.sort,
      skip,
      take: pageSize + 1,
    });
    if (!sql) {
      return new PaginatedResponseDTO([], 0, page, pageSize);
    }

    const rows =
      await this.prisma.$queryRaw<MarketplaceProductSearchRow[]>(sql);
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const total = skip + pageRows.length + (hasMore ? 1 : 0);
    return new PaginatedResponseDTO(
      pageRows.map((row) => toLeanMarketplaceProduct(row)),
      total,
      page,
      pageSize,
    );
  }

  async listRelatedProducts(
    query: MarketplaceRelatedQueryDto,
  ): Promise<PaginatedResponseDTO<ResponseMarketplaceProductDto>> {
    const limit = Math.min(Math.max(query.limit ?? 8, 1), 24);
    const source = await this.prisma.product.findFirst({
      where: {
        id: query.productId,
        isActive: true,
        isPublished: true,
        publishedAt: { not: null },
        shop: {
          status: ShopStatus.ACTIVE,
          subscriptionEndsAt: { gt: new Date() },
          storeSettings: { isEnabled: true },
        },
      },
      select: {
        id: true,
        name: true,
        model: true,
        trackingType: true,
        brand: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    if (!source) {
      throw new NotFoundException(resourceNotFound('Product', query.productId));
    }

    const sourceInfo: RelatedSourceProduct = {
      id: source.id,
      name: source.name,
      model: source.model,
      trackingType: source.trackingType,
      brandName: source.brand.name,
      categoryName: source.category.name,
    };
    const tokens = buildRelatedSearchTokens(sourceInfo);
    const wantAccessories = isDeviceProduct(sourceInfo);

    const accessoryCategoryOr = MARKETPLACE_ACCESSORY_CATEGORY_NAMES.map(
      (name) => ({
        category: { name: { equals: name, mode: 'insensitive' as const } },
      }),
    );

    const catalogWhere = storefrontCatalogWhere(null);
    const where: Prisma.ProductWhereInput = {
      ...catalogWhere,
      id: { not: source.id },
      shop: marketplaceShopWhere(query.city),
      OR: wantAccessories
        ? [{ trackingType: 'QUANTITY' }, ...accessoryCategoryOr]
        : [
            { trackingType: 'QUANTITY' },
            ...accessoryCategoryOr,
            {
              brand: {
                name: {
                  equals: source.brand.name,
                  mode: 'insensitive',
                },
              },
            },
          ],
    };

    const rows = await this.prisma.product.findMany({
      where,
      take: RELATED_CANDIDATE_SCAN,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: MARKETPLACE_PRODUCT_INCLUDE,
    });

    const scored = rows
      .map((row) => ({
        row,
        score: scoreRelatedAccessory(
          {
            id: row.id,
            name: row.name,
            model: row.model,
            trackingType: row.trackingType,
            categoryName: row.category.name,
            brandName: row.brand.name,
          },
          sourceInfo,
          tokens,
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aTime = a.row.publishedAt?.getTime() ?? 0;
        const bTime = b.row.publishedAt?.getTime() ?? 0;
        return bTime - aTime;
      });

    const seenKeys = new Set<string>();
    const unique: typeof scored = [];
    for (const entry of scored) {
      const key = `${slugify(entry.row.brand.name)}--${slugify(entry.row.name)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      unique.push(entry);
      if (unique.length >= limit) break;
    }

    return new PaginatedResponseDTO(
      unique.map((entry) => toMarketplaceProduct(entry.row)),
      unique.length,
      1,
      limit,
    );
  }
}
