import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateBrandDto } from '../dto/create-brand.dto.js';
import { UpdateBrandDto } from '../dto/update-brand.dto.js';
import { BrandQueryFilterDto } from '../dto/brand-query.filter.js';
import { ResponseBrandDto } from '../dto/response-brand.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { resourceNotFound, duplicateName } from '../../errors/error.builder.js';
import { buildShopNamedEntityWhere } from '../../helpers/catalog-list.helper.js';
import { isUniqueConstraintViolation } from '../../helpers/prisma-error-helper.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createBrand(
    dto: CreateBrandDto,
    shopId: string,
    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const name = dto.name.trim();
    try {
      await this.prisma.brand.create({
        data: {
          shopId,
          name,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new BadRequestException(duplicateName('Brand', name));
      }
      throw error;
    }
    return new StatusBaseResponseDTO(true, 'Brand created successfully');
  }

  async getBrands(
    query: BrandQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseBrandDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.BrandWhereInput = buildShopNamedEntityWhere(
      shopId,
      query.search,
      query.isActive,
    );

    const [items, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: [{ [sortBy]: sortOrder }, { id: 'asc' }],
      }),
      this.prisma.brand.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseBrandDto>(
      items,
      total,
      page,
      pageSize,
    );
  }

  async getBrandById(id: string, shopId: string): Promise<ResponseBrandDto> {
    const brand = await this.prisma.brand.findFirst({
      where: { id, shopId },
    });
    if (!brand) {
      throw new NotFoundException(resourceNotFound('Brand', id));
    }
    return brand;
  }

  async updateBrand(
    id: string,
    dto: UpdateBrandDto,
    shopId: string,
    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const newName = dto.name?.trim();
    const data: Prisma.BrandUpdateManyMutationInput = {};
    if (newName !== undefined) data.name = newName;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      const result = await this.prisma.brand.updateMany({
        where: { id, shopId },
        data,
      });
      if (result.count === 0) {
        throw new NotFoundException(resourceNotFound('Brand', id));
      }
    } catch (error) {
      if (isUniqueConstraintViolation(error) && newName !== undefined) {
        throw new BadRequestException(duplicateName('Brand', newName));
      }
      throw error;
    }
    return new StatusBaseResponseDTO(true, 'Brand updated successfully');
  }

  async deleteBrand(
    id: string,
    shopId: string,
    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const result = await this.prisma.brand.updateMany({
      where: { id, shopId },
      data: { isActive: false },
    });
    if (result.count === 0) {
      throw new NotFoundException(resourceNotFound('Brand', id));
    }
    return new StatusBaseResponseDTO(true, 'Brand deactivated successfully');
  }
}
