import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateProductDto } from '../dto/create-product.dto.js';
import { UpdateProductDto } from '../dto/update-product.dto.js';
import { ProductQueryFilterDto } from '../dto/product-query.filter.js';
import { ResponseProductDto } from '../dto/response-product.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  resourceNotFound,
  productNotPublishable,
  productsNeedPhotosToPublish,
} from '../../errors/error.builder.js';
import { BulkPublishProductsDto } from '../dto/bulk-publish-products.dto.js';
import {
  PRODUCT_INCLUDE,
  mapProductToResponse,
} from '../helpers/product.mapper.js';
import { assertNoDuplicateVariant } from '../helpers/product-variant-uniqueness.helper.js';
import {
  assertBrandOwned,
  assertCategoryOwned,
  assertPtaForBrand,
  assertTrackingTypeChangeAllowed,
  mapProductDuplicate,
} from '../helpers/product-write-guards.helper.js';
import {
  buildProductListWhere,
  buildProductStockFilterSql,
  productListNeedsStockJoin,
} from '../helpers/product-list-where.helper.js';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storefrontRevalidate: StorefrontRevalidateService,
  ) {}

  async createProduct(
    dto: CreateProductDto,
    shopId: string,
    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const name = dto.name.trim();
    const sku = dto.sku?.trim() || null;
    const barcode = dto.barcode?.trim() || null;

    await assertCategoryOwned(this.prisma, dto.categoryId, shopId);
    const brandName = await assertBrandOwned(this.prisma, dto.brandId, shopId);
    assertPtaForBrand(brandName, dto.ptaStatus, dto.trackingType);

    const willBeActive = dto.isActive ?? true;
    if (dto.isPublished === true && !willBeActive) {
      throw new BadRequestException(productNotPublishable(name));
    }

    const model = dto.model?.trim() || null;
    const color = dto.color?.trim() || null;
    const ram = dto.ram?.trim() || null;
    const storage = dto.storage?.trim() || null;
    const ptaStatus =
      dto.trackingType === 'SERIALIZED' ? (dto.ptaStatus ?? null) : null;
    const authenticity = dto.authenticity ?? null;

    if (willBeActive) {
      await assertNoDuplicateVariant(this.prisma, shopId, {
        brandId: dto.brandId,
        name,
        model,
        color,
        ram,
        storage,
        ptaStatus,
        authenticity,
      });
    }

    let createdProductId = '';
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const product = await tx.product.create({
            data: {
              shopId,
              categoryId: dto.categoryId,
              brandId: dto.brandId,
              name,
              trackingType: dto.trackingType,
              model,
              color,
              ram,
              storage,
              sku,
              barcode,
              description: dto.description?.trim() || null,
              imageUrl: dto.imageUrl?.trim() || null,
              defaultPurchasePrice: dto.defaultPurchasePrice ?? 0,
              defaultSellingPrice: dto.defaultSellingPrice ?? 0,
              lowStockThreshold: dto.lowStockThreshold ?? 0,
              isActive: willBeActive,
              isPublished: dto.isPublished ?? false,
              publicDescription: dto.publicDescription?.trim() || null,
              ptaStatus,
              authenticity,
            },
          });
          createdProductId = product.id;

          if (dto.trackingType === 'QUANTITY') {
            await tx.stockLevel.create({
              data: {
                productId: product.id,
                shopId,
                quantityOnHand: 0,
                avgUnitCost: 0,
              },
            });
          }
        },
        {
          maxWait: 15_000,
          timeout: 30_000,
        },
      );
    } catch (error) {
      throw mapProductDuplicate(error, sku, barcode, name);
    }

    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(
      true,
      'Product created successfully',
      createdProductId,
    );
  }

  async getProducts(
    query: ProductQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseProductDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'desc';
    let where = buildProductListWhere(query, shopId);

    if (productListNeedsStockJoin(query)) {
      const matched = await this.prisma.$queryRaw<Array<{ id: string }>>(
        buildProductStockFilterSql(query, shopId),
      );
      where = {
        ...where,
        id: { in: matched.map((row) => row.id) },
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }],
      }),
      this.prisma.product.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseProductDto>(
      rows.map((row) => mapProductToResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getProductById(
    id: string,
    shopId: string,
  ): Promise<ResponseProductDto> {
    const row = await this.prisma.product.findFirst({
      where: { id, shopId },
      include: PRODUCT_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(resourceNotFound('Product', id));
    }
    return mapProductToResponse(row);
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
    shopId: string,
    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const existing = await this.prisma.product.findFirst({
      where: { id, shopId },
    });
    if (!existing) {
      throw new NotFoundException(resourceNotFound('Product', id));
    }

    const newName = dto.name?.trim();

    if (dto.categoryId !== undefined) {
      await assertCategoryOwned(this.prisma, dto.categoryId, shopId);
    }
    let brandName: string | undefined;
    if (dto.brandId !== undefined) {
      brandName = await assertBrandOwned(this.prisma, dto.brandId, shopId);
    } else {
      const brand = await this.prisma.brand.findFirst({
        where: { id: existing.brandId, shopId },
        select: { name: true },
      });
      brandName = brand?.name;
    }

    const trackingTypeChanges =
      dto.trackingType !== undefined &&
      dto.trackingType !== existing.trackingType;

    if (trackingTypeChanges) {
      const nextTrackingType = dto.trackingType;
      if (nextTrackingType === undefined) {
        throw new BadRequestException('trackingType is required');
      }
      await assertTrackingTypeChangeAllowed(
        this.prisma,
        id,
        existing.name,
        nextTrackingType,
      );
    }

    const willBeActive = dto.isActive ?? existing.isActive;
    if (dto.isPublished === true && !willBeActive) {
      throw new BadRequestException(productNotPublishable(existing.name));
    }
    if (dto.isPublished === true) {
      const imageCount = await this.prisma.productImage.count({
        where: { productId: id },
      });
      if (imageCount === 0) {
        throw new BadRequestException(
          productsNeedPhotosToPublish([existing.name]),
        );
      }
    }

    const nextTrackingForPta = dto.trackingType ?? existing.trackingType;
    const nextPta =
      dto.ptaStatus !== undefined ? dto.ptaStatus : existing.ptaStatus;
    assertPtaForBrand(brandName, nextPta, nextTrackingForPta);

    const nextBrandId = dto.brandId ?? existing.brandId;
    const nextName = newName ?? existing.name;
    const nextModel =
      dto.model !== undefined
        ? dto.model === null
          ? null
          : dto.model.trim() || null
        : existing.model;
    const nextColor =
      dto.color !== undefined
        ? dto.color === null
          ? null
          : dto.color.trim() || null
        : existing.color;
    const nextRam =
      dto.ram !== undefined
        ? dto.ram === null
          ? null
          : dto.ram.trim() || null
        : existing.ram;
    const nextStorage =
      dto.storage !== undefined
        ? dto.storage === null
          ? null
          : dto.storage.trim() || null
        : existing.storage;
    const nextAuthenticity =
      dto.authenticity !== undefined
        ? dto.authenticity || null
        : existing.authenticity;
    const nextTracking = dto.trackingType ?? existing.trackingType;
    const nextPtaStored =
      nextTracking === 'SERIALIZED'
        ? dto.ptaStatus !== undefined
          ? dto.ptaStatus
          : existing.ptaStatus
        : null;

    const normStr = (val?: string | null): string =>
      val?.trim().toLowerCase() ?? '';
    const existingPtaStored =
      existing.trackingType === 'SERIALIZED'
        ? (existing.ptaStatus ?? null)
        : null;

    const brandChanged = existing.brandId !== nextBrandId;
    const reactivating = !existing.isActive && willBeActive;

    const variantChanged =
      brandChanged ||
      reactivating ||
      normStr(nextName) !== normStr(existing.name) ||
      normStr(nextModel) !== normStr(existing.model) ||
      normStr(nextColor) !== normStr(existing.color) ||
      normStr(nextRam) !== normStr(existing.ram) ||
      normStr(nextStorage) !== normStr(existing.storage) ||
      existingPtaStored !== nextPtaStored ||
      (existing.authenticity ?? null) !== (nextAuthenticity ?? null) ||
      trackingTypeChanges;

    if (variantChanged && willBeActive) {
      await assertNoDuplicateVariant(
        this.prisma,
        shopId,
        {
          brandId: nextBrandId,
          name: nextName,
          model: nextModel,
          color: nextColor,
          ram: nextRam,
          storage: nextStorage,
          ptaStatus: nextPtaStored,
          authenticity: nextAuthenticity,
        },
        id,
      );
    }

    const data: Prisma.ProductUpdateInput = {};
    if (newName !== undefined) data.name = newName;
    if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }
    if (dto.brandId !== undefined) {
      data.brand = { connect: { id: dto.brandId } };
    }
    if (dto.trackingType !== undefined) data.trackingType = dto.trackingType;
    if (dto.model !== undefined) {
      data.model = dto.model === null ? null : dto.model.trim() || null;
    }
    if (dto.color !== undefined) {
      data.color = dto.color === null ? null : dto.color.trim() || null;
    }
    if (dto.ram !== undefined) {
      data.ram = dto.ram === null ? null : dto.ram.trim() || null;
    }
    if (dto.storage !== undefined) {
      data.storage = dto.storage === null ? null : dto.storage.trim() || null;
    }
    if (dto.sku !== undefined) {
      data.sku = dto.sku === null ? null : dto.sku.trim() || null;
    }
    if (dto.barcode !== undefined) {
      data.barcode = dto.barcode === null ? null : dto.barcode.trim() || null;
    }
    if (dto.description !== undefined) {
      data.description =
        dto.description === null ? null : dto.description.trim() || null;
    }
    if (dto.imageUrl !== undefined) {
      data.imageUrl =
        dto.imageUrl === null ? null : dto.imageUrl.trim() || null;
    }
    if (dto.defaultPurchasePrice !== undefined) {
      data.defaultPurchasePrice = dto.defaultPurchasePrice;
    }
    if (dto.defaultSellingPrice !== undefined) {
      data.defaultSellingPrice = dto.defaultSellingPrice;
    }
    if (dto.lowStockThreshold !== undefined) {
      data.lowStockThreshold = dto.lowStockThreshold;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
      if (dto.isActive === false) {
        data.isPublished = false;
      }
    }

    if (dto.isPublished !== undefined && dto.isActive !== false) {
      data.isPublished = dto.isPublished;
    }
    if (dto.publicDescription !== undefined) {
      data.publicDescription =
        dto.publicDescription === null
          ? null
          : dto.publicDescription.trim() || null;
    }
    if (dto.ptaStatus !== undefined) {
      data.ptaStatus = nextTracking === 'SERIALIZED' ? dto.ptaStatus : null;
    } else if (trackingTypeChanges && nextTracking === 'QUANTITY') {
      data.ptaStatus = null;
    }
    if (dto.authenticity !== undefined) {
      data.authenticity = dto.authenticity || null;
    }

    if (Object.keys(data).length === 0) {
      return new StatusBaseResponseDTO(true, 'Product updated successfully');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({ where: { id }, data });

        if (trackingTypeChanges) {
          if (dto.trackingType === 'QUANTITY') {
            const existingLevel = await tx.stockLevel.findUnique({
              where: { productId: id },
            });
            if (!existingLevel) {
              await tx.stockLevel.create({
                data: {
                  productId: id,
                  shopId,
                  quantityOnHand: 0,
                  avgUnitCost: 0,
                },
              });
            }
          } else {
            await tx.stockLevel.deleteMany({ where: { productId: id } });
          }
        }
      });
    } catch (error) {
      throw mapProductDuplicate(
        error,
        data.sku !== undefined ? (data.sku as string | null) : undefined,
        data.barcode !== undefined
          ? (data.barcode as string | null)
          : undefined,
        nextName,
      );
    }

    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(true, 'Product updated successfully');
  }

  async deleteProduct(
    id: string,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const result = await this.prisma.product.updateMany({
      where: { id, shopId },
      data: { isActive: false, isPublished: false },
    });
    if (result.count === 0) {
      throw new NotFoundException(resourceNotFound('Product', id));
    }
    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(true, 'Product deactivated successfully');
  }

  async publishProducts(
    dto: BulkPublishProductsDto,
    shopId: string,
  ): Promise<StatusBaseResponseDTO> {
    const ids = [...new Set(dto.ids)];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, shopId },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: { select: { images: true } },
      },
    });

    if (products.length !== ids.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = ids.find((id) => !found.has(id));
      if (missing) {
        throw new NotFoundException(resourceNotFound('Product', missing));
      }
    }

    if (dto.isPublished) {
      const inactive = products.find((p) => !p.isActive);
      if (inactive) {
        throw new BadRequestException(productNotPublishable(inactive.name));
      }
      const withoutPhotos = products.filter((p) => p._count.images === 0);
      if (withoutPhotos.length > 0) {
        throw new BadRequestException(
          productsNeedPhotosToPublish(withoutPhotos.map((p) => p.name)),
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { id: { in: ids }, shopId },
        data: { isPublished: dto.isPublished },
      });
    });

    const count = products.length;
    const word = `${count} product${count === 1 ? '' : 's'}`;
    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(
      true,
      `${word} ${dto.isPublished ? 'published' : 'unpublished'} successfully`,
    );
  }
}
