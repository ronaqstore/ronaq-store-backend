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
  duplicateFieldValue,
  duplicateProductVariant,
  trackingTypeLocked,
  stockNotEmptyForTrackingChange,
  productNotPublishable,
  ptaStatusNotAllowedForBrand,
} from '../../errors/error.builder.js';
import {
  isUniqueConstraintViolation,
  violatedColumn,
} from '../../helpers/prisma-error-helper.js';
import { isPtaAllowedForBrand } from '../../helpers/device-family.helper.js';
import { BulkPublishProductsDto } from '../dto/bulk-publish-products.dto.js';
import {
  PRODUCT_INCLUDE,
  mapProductToResponse,
} from '../helpers/product.mapper.js';
import { assertNoDuplicateVariant } from '../helpers/product-variant-uniqueness.helper.js';
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

    await this.assertCategoryOwned(dto.categoryId, shopId);
    const brandName = await this.assertBrandOwned(dto.brandId, shopId);
    this.assertPtaForBrand(brandName, dto.ptaStatus, dto.trackingType);

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

    await assertNoDuplicateVariant(this.prisma, shopId, {
      name,
      model,
      color,
      ram,
      storage,
      ptaStatus,
      authenticity,
    });

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
      throw this.mapDuplicate(error, sku, barcode, name);
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
    const newSku = dto.sku?.trim();
    const newBarcode = dto.barcode?.trim();

    if (dto.categoryId !== undefined) {
      await this.assertCategoryOwned(dto.categoryId, shopId);
    }
    let brandName: string | undefined;
    if (dto.brandId !== undefined) {
      brandName = await this.assertBrandOwned(dto.brandId, shopId);
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
      await this.assertTrackingTypeChangeAllowed(
        id,
        existing.name,
        nextTrackingType,
      );
    }

    const willBeActive = dto.isActive ?? existing.isActive;
    if (dto.isPublished === true && !willBeActive) {
      throw new BadRequestException(productNotPublishable(existing.name));
    }

    const nextTrackingForPta = dto.trackingType ?? existing.trackingType;
    const nextPta =
      dto.ptaStatus !== undefined ? dto.ptaStatus : existing.ptaStatus;
    this.assertPtaForBrand(brandName, nextPta, nextTrackingForPta);

    const nextName = newName ?? existing.name;
    const nextModel =
      dto.model !== undefined ? dto.model?.trim() || null : existing.model;
    const nextColor =
      dto.color !== undefined ? dto.color?.trim() || null : existing.color;
    const nextRam =
      dto.ram !== undefined ? dto.ram?.trim() || null : existing.ram;
    const nextStorage =
      dto.storage !== undefined
        ? dto.storage?.trim() || null
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

    const variantChanged =
      normStr(nextName) !== normStr(existing.name) ||
      normStr(nextModel) !== normStr(existing.model) ||
      normStr(nextColor) !== normStr(existing.color) ||
      normStr(nextRam) !== normStr(existing.ram) ||
      normStr(nextStorage) !== normStr(existing.storage) ||
      existingPtaStored !== nextPtaStored ||
      (existing.authenticity ?? null) !== (nextAuthenticity ?? null) ||
      trackingTypeChanges;

    if (variantChanged) {
      await assertNoDuplicateVariant(
        this.prisma,
        shopId,
        {
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
    if (dto.model !== undefined) data.model = dto.model?.trim() || null;
    if (dto.color !== undefined) data.color = dto.color?.trim() || null;
    if (dto.ram !== undefined) data.ram = dto.ram?.trim() || null;
    if (dto.storage !== undefined) data.storage = dto.storage?.trim() || null;
    if (newSku !== undefined) data.sku = newSku || null;
    if (newBarcode !== undefined) data.barcode = newBarcode || null;
    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null;
    if (dto.imageUrl !== undefined)
      data.imageUrl = dto.imageUrl?.trim() || null;
    if (dto.defaultPurchasePrice !== undefined) {
      data.defaultPurchasePrice = dto.defaultPurchasePrice;
    }
    if (dto.defaultSellingPrice !== undefined) {
      data.defaultSellingPrice = dto.defaultSellingPrice;
    }
    if (dto.lowStockThreshold !== undefined) {
      data.lowStockThreshold = dto.lowStockThreshold;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;
    if (dto.publicDescription !== undefined) {
      data.publicDescription = dto.publicDescription?.trim() || null;
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
      throw this.mapDuplicate(error, newSku, newBarcode, nextName);
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
      data: { isActive: false },
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
      select: { id: true, name: true, isActive: true },
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

  private async assertCategoryOwned(
    categoryId: string,
    shopId: string,
  ): Promise<void> {
    const found = await this.prisma.category.findFirst({
      where: { id: categoryId, shopId },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(resourceNotFound('Category', categoryId));
    }
  }

  private async assertBrandOwned(
    brandId: string,
    shopId: string,
  ): Promise<string> {
    const found = await this.prisma.brand.findFirst({
      where: { id: brandId, shopId },
      select: { id: true, name: true },
    });
    if (!found) {
      throw new NotFoundException(resourceNotFound('Brand', brandId));
    }
    return found.name;
  }

  private assertPtaForBrand(
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

  private async assertTrackingTypeChangeAllowed(
    productId: string,
    productName: string,
    nextType: 'QUANTITY' | 'SERIALIZED',
  ): Promise<void> {
    const [purchaseRefs, saleRefs] = await Promise.all([
      this.prisma.purchaseItem.count({ where: { productId } }),
      this.prisma.saleItem.count({ where: { productId } }),
    ]);
    if (purchaseRefs + saleRefs > 0) {
      throw new BadRequestException(trackingTypeLocked(productName));
    }

    if (nextType === 'SERIALIZED') {
      const level = await this.prisma.stockLevel.findUnique({
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

  private mapDuplicate(
    error: unknown,
    sku?: string | null,
    barcode?: string | null,
    name?: string,
  ): unknown {
    if (!isUniqueConstraintViolation(error)) return error;

    if (violatedColumn(error, 'variant')) {
      return new BadRequestException(
        duplicateProductVariant(name ?? 'Product'),
      );
    }
    if (sku && violatedColumn(error, 'sku')) {
      return new BadRequestException(
        duplicateFieldValue('Product', 'SKU', sku),
      );
    }
    if (barcode && violatedColumn(error, 'barcode')) {
      return new BadRequestException(
        duplicateFieldValue('Product', 'barcode', barcode),
      );
    }
    return error;
  }
}
