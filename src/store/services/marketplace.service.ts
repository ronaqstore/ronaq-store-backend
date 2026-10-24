import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ShopStatus } from '../../generated/prisma/enums.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { toLocalPkPhone } from '../../helpers/phone.helper.js';
import {
  parseModelKey,
  slugify,
  toModelKey,
} from '../../helpers/slug.helper.js';
import { resourceNotFound } from '../../errors/error.builder.js';
import {
  STOREFRONT_PRODUCT_INCLUDE,
  storefrontCatalogWhere,
  toStorefrontProduct,
} from '../helpers/storefront.mapper.js';
import {
  nearestMarketplaceHub,
  paginateMarketplaceHubs,
  resolveHubCityTokens,
} from '../helpers/marketplace-hub.helper.js';
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
import type { MarketplaceHubDefinition } from '../constants/marketplace-hubs.constant.js';
import type {
  MarketplaceProductModelLabelRow,
  MarketplaceProductModelMatchRow,
} from './marketplace.service.types.js';

const MODEL_SUGGESTION_SCAN = 250;
const MODEL_KEY_SCAN = 500;
const RELATED_CANDIDATE_SCAN = 120;

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  private toHubDto(hub: MarketplaceHubDefinition): ResponseMarketplaceHubDto {
    return {
      id: hub.id,
      name: hub.name,
      latitude: hub.latitude,
      longitude: hub.longitude,
    };
  }

  private marketplaceShopWhere(
    city?: string | null,
  ): Prisma.ProductWhereInput['shop'] {
    const cityTokens = resolveHubCityTokens(city);
    return {
      status: ShopStatus.ACTIVE,
      storeSettings: {
        isEnabled: true,
        ...(cityTokens
          ? {
              OR: cityTokens.map((token) => ({
                city: { equals: token, mode: 'insensitive' as const },
              })),
            }
          : {}),
      },
    };
  }

  private productModelLabel(row: MarketplaceProductModelLabelRow): string {
    return (row.model?.trim() || row.name).trim();
  }

  private matchesModelKey(
    row: MarketplaceProductModelMatchRow,
    brandSlug: string,
    modelSlug: string,
  ): boolean {
    return (
      slugify(row.brand.name) === brandSlug &&
      slugify(this.productModelLabel(row)) === modelSlug
    );
  }

  private appendAnd(
    where: Prisma.ProductWhereInput,
    clause: Prisma.ProductWhereInput,
  ): void {
    const existing = where.AND;
    where.AND = [
      ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
      clause,
    ];
  }

  private applyMarketplaceListingFilters(
    where: Prisma.ProductWhereInput,
    query: MarketplaceProductsQueryDto,
  ): Prisma.ProductOrderByWithRelationInput[] {
    if (query.condition === 'NEW' || query.condition === 'USED') {
      if (query.condition === 'USED') {
        this.appendAnd(where, {
          trackingType: 'SERIALIZED',
          inventoryUnits: {
            some: {
              status: 'IN_STOCK',
              condition: 'USED',
            },
          },
        });
      } else {
        this.appendAnd(where, {
          OR: [
            {
              trackingType: 'SERIALIZED',
              inventoryUnits: {
                some: {
                  status: 'IN_STOCK',
                  condition: 'NEW',
                },
              },
            },
            { trackingType: 'QUANTITY' },
          ],
        });
      }
    }

    if (query.minPrice != null || query.maxPrice != null) {
      let minPrice = query.minPrice;
      let maxPrice = query.maxPrice;
      if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
        const swap = minPrice;
        minPrice = maxPrice;
        maxPrice = swap;
      }
      where.defaultSellingPrice = {
        ...(minPrice != null ? { gte: BigInt(minPrice) } : {}),
        ...(maxPrice != null ? { lte: BigInt(maxPrice) } : {}),
      };
    }

    if (query.ptaStatus) {
      where.ptaStatus = query.ptaStatus;
    }

    if (query.authenticity) {
      where.authenticity = query.authenticity;
    }

    if (query.sort === 'price_asc') {
      return [{ defaultSellingPrice: 'asc' }, { publishedAt: 'desc' }];
    }
    if (query.sort === 'price_desc') {
      return [{ defaultSellingPrice: 'desc' }, { publishedAt: 'desc' }];
    }
    return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
  }

  private toMarketplaceProduct(
    row: Prisma.ProductGetPayload<{
      include: typeof STOREFRONT_PRODUCT_INCLUDE & {
        shop: {
          select: {
            storeSettings: {
              select: {
                slug: true;
                displayName: true;
                city: true;
                whatsappNumber: true;
                showExactStock: true;
              };
            };
          };
        };
      };
    }>,
  ): ResponseMarketplaceProductDto {
    const settings = row.shop.storeSettings;
    const product = toStorefrontProduct(row, settings?.showExactStock ?? false);
    return {
      ...product,
      shop: {
        slug: settings?.slug ?? '',
        displayName: settings?.displayName ?? '',
        city: settings?.city ?? null,
        whatsappNumber:
          toLocalPkPhone(settings?.whatsappNumber) ??
          settings?.whatsappNumber ??
          null,
      },
    };
  }

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
      result.items.map((hub) => this.toHubDto(hub)),
      result.total,
      result.page,
      result.pageSize,
    );
  }

  resolveNearestHub(query: NearestHubQueryDto): ResponseMarketplaceHubDto {
    return this.toHubDto(
      nearestMarketplaceHub(query.latitude, query.longitude),
    );
  }

  async searchModels(
    query: MarketplaceModelsQueryDto,
  ): Promise<{ items: ResponseMarketplaceModelDto[]; total: number }> {
    const q = query.q?.trim() ?? '';
    if (q.length < 2) {
      return { items: [], total: 0 };
    }

    const limit = Math.min(Math.max(query.limit ?? 8, 1), 20);
    const catalogWhere = storefrontCatalogWhere(null, { q });
    const rows = await this.prisma.product.findMany({
      where: {
        ...catalogWhere,
        shop: this.marketplaceShopWhere(query.city),
      },
      take: MODEL_SUGGESTION_SCAN,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        name: true,
        model: true,
        defaultSellingPrice: true,
        brand: { select: { name: true } },
        images: {
          select: { url: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    });

    type Group = {
      modelKey: string;
      brand: string;
      model: string;
      count: number;
      imageUrl: string | null;
      minPrice: number | null;
    };

    const groups = new Map<string, Group>();
    for (const row of rows) {
      const modelLabel = this.productModelLabel(row);
      const modelKey = toModelKey(row.brand.name, modelLabel);
      const price = Number(row.defaultSellingPrice);
      const existing = groups.get(modelKey);
      if (existing) {
        existing.count += 1;
        if (
          Number.isFinite(price) &&
          (existing.minPrice == null || price < existing.minPrice)
        ) {
          existing.minPrice = price;
        }
        if (!existing.imageUrl && row.images[0]?.url) {
          existing.imageUrl = row.images[0].url;
        }
        continue;
      }
      groups.set(modelKey, {
        modelKey,
        brand: row.brand.name,
        model: modelLabel,
        count: 1,
        imageUrl: row.images[0]?.url ?? null,
        minPrice: Number.isFinite(price) ? price : null,
      });
    }

    const sorted = [...groups.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.model.localeCompare(b.model);
    });

    const items: ResponseMarketplaceModelDto[] = sorted
      .slice(0, limit)
      .map((group) => ({
        modelKey: group.modelKey,
        brand: group.brand,
        model: group.model,
        title: `${group.brand} ${group.model}`.trim(),
        count: group.count,
        imageUrl: group.imageUrl,
        minPrice: group.minPrice,
      }));

    return { items, total: groups.size };
  }

  async listProducts(
    query: MarketplaceProductsQueryDto,
  ): Promise<PaginatedResponseDTO<ResponseMarketplaceProductDto>> {
    const { page, pageSize } = normalizePagination(query.page, query.limit, 50);
    const parsedModel = query.modelKey ? parseModelKey(query.modelKey) : null;

    const catalogWhere = storefrontCatalogWhere(null, {
      q: parsedModel ? undefined : query.q,
      category: query.category,
      brand: query.brand,
      inStock: query.inStock,
    });

    const where: Prisma.ProductWhereInput = {
      ...catalogWhere,
      shop: this.marketplaceShopWhere(query.city),
    };
    const orderBy = this.applyMarketplaceListingFilters(where, query);

    const include = {
      ...STOREFRONT_PRODUCT_INCLUDE,
      shop: {
        select: {
          storeSettings: {
            select: {
              slug: true,
              displayName: true,
              city: true,
              whatsappNumber: true,
              showExactStock: true,
            },
          },
        },
      },
    } as const;

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
        include,
      });
      const matched = rows.filter((row) =>
        this.matchesModelKey(row, parsedModel.brandSlug, parsedModel.modelSlug),
      );
      const skip = getSkipNumber(page, pageSize);
      const pageRows = matched.slice(skip, skip + pageSize);
      return new PaginatedResponseDTO(
        pageRows.map((row) => this.toMarketplaceProduct(row)),
        matched.length,
        page,
        pageSize,
      );
    }

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy,
        include,
      }),
      this.prisma.product.count({ where }),
    ]);

    return new PaginatedResponseDTO(
      rows.map((row) => this.toMarketplaceProduct(row)),
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
      shop: this.marketplaceShopWhere(query.city),
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

    const include = {
      ...STOREFRONT_PRODUCT_INCLUDE,
      shop: {
        select: {
          storeSettings: {
            select: {
              slug: true,
              displayName: true,
              city: true,
              whatsappNumber: true,
              showExactStock: true,
            },
          },
        },
      },
    } as const;

    const rows = await this.prisma.product.findMany({
      where,
      take: RELATED_CANDIDATE_SCAN,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include,
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
      unique.map((entry) => this.toMarketplaceProduct(entry.row)),
      unique.length,
      1,
      limit,
    );
  }
}
