import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateExpenseCategoryDto } from '../dto/create-expense-category.dto.js';
import { UpdateExpenseCategoryDto } from '../dto/update-expense-category.dto.js';
import { ExpenseCategoryQueryFilterDto } from '../dto/expense-category-query.filter.js';
import { ResponseExpenseCategoryDto } from '../dto/response-expense-category.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  resourceNotFound,
  duplicateName,
  requiredFieldCannotBeNull,
} from '../../errors/error.builder.js';
import { buildShopNamedEntityWhere } from '../../helpers/catalog-list.helper.js';
import { isUniqueConstraintViolation } from '../../helpers/prisma-error-helper.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class ExpenseCategoriesService {
  private readonly logger = new Logger(ExpenseCategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createExpenseCategory(
    dto: CreateExpenseCategoryDto,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const name = dto.name.trim();
    try {
      await this.prisma.expenseCategory.create({
        data: {
          shopId,
          name,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new BadRequestException(duplicateName('Expense category', name));
      }
      throw error;
    }

    return new StatusBaseResponseDTO(
      true,
      'Expense category created successfully',
    );
  }

  async getExpenseCategories(
    query: ExpenseCategoryQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseExpenseCategoryDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';

    const where: Prisma.ExpenseCategoryWhereInput = buildShopNamedEntityWhere(
      shopId,
      query.search,
      query.isActive,
    );

    const [items, total] = await Promise.all([
      this.prisma.expenseCategory.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.expenseCategory.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseExpenseCategoryDto>(
      items,
      total,
      page,
      pageSize,
    );
  }

  async getExpenseCategoryById(
    id: string,
    shopId: string,
  ): Promise<ResponseExpenseCategoryDto> {
    const expenseCategory = await this.prisma.expenseCategory.findFirst({
      where: { id, shopId },
    });
    if (!expenseCategory) {
      throw new NotFoundException(resourceNotFound('Expense category', id));
    }
    return expenseCategory;
  }

  async updateExpenseCategory(
    id: string,
    dto: UpdateExpenseCategoryDto,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    let newName: string | undefined;
    if (dto.name !== undefined) {
      if (dto.name === null) {
        throw new BadRequestException(
          requiredFieldCannotBeNull('Expense category', 'Name'),
        );
      }
      newName = dto.name.trim();
    }
    const data: Prisma.ExpenseCategoryUpdateManyMutationInput = {};
    if (newName !== undefined) data.name = newName;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    try {
      const result = await this.prisma.expenseCategory.updateMany({
        where: { id, shopId },
        data,
      });
      if (result.count === 0) {
        throw new NotFoundException(resourceNotFound('Expense category', id));
      }
    } catch (error) {
      if (isUniqueConstraintViolation(error) && newName !== undefined) {
        throw new BadRequestException(
          duplicateName('Expense category', newName),
        );
      }
      throw error;
    }

    return new StatusBaseResponseDTO(
      true,
      'Expense category updated successfully',
    );
  }

  async deleteExpenseCategory(
    id: string,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const result = await this.prisma.expenseCategory.updateMany({
      where: { id, shopId },
      data: { isActive: false },
    });
    if (result.count === 0) {
      throw new NotFoundException(resourceNotFound('Expense category', id));
    }

    return new StatusBaseResponseDTO(
      true,
      'Expense category deactivated successfully',
    );
  }
}
