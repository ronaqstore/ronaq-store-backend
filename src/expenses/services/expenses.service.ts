import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  CashDirection,
  CashMovementType,
  RecordStatus,
  ReferenceType,
} from '../../generated/prisma/enums.js';
import { CreateExpenseDto } from '../dto/create-expense.dto.js';
import { CancelExpenseDto } from '../dto/cancel-expense.dto.js';
import { ExpenseQueryFilterDto } from '../dto/expense-query.filter.js';
import { ResponseExpenseDto } from '../dto/response-expense.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { probeCashOverdraft } from '../../helpers/cash-balance.helper.js';
import {
  cancelledRowMutationForbidden,
  resourceNotFound,
} from '../../errors/error.builder.js';
import { buildAmountRangeFilter } from '../../common-dto/helpers/amount-range-filter.helper.js';
import { buildTokenizedSearchAnd } from '../../helpers/tokenized-search.helper.js';
import { resolveTransactionDate } from '../../helpers/date.helper.js';

const EXPENSE_INCLUDE = {
  category: { select: { name: true } },
} satisfies Prisma.ExpenseInclude;

type ExpenseWithCategory = Prisma.ExpenseGetPayload<{
  include: typeof EXPENSE_INCLUDE;
}>;

export type CreateExpenseResult =
  StatusBaseResponseDTO | PurchaseOverdraftResponseDto;

const CREATED = 'Expense recorded successfully';
const CANCELLED = 'Expense cancelled successfully';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createExpense(
    dto: CreateExpenseDto,
    shopId: string,
    userId: string,
  ): Promise<CreateExpenseResult> {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id: dto.categoryId, shopId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException(
        resourceNotFound('Expense category', dto.categoryId),
      );
    }

    const amount = BigInt(dto.amount);

    const outcome = await this.prisma.$transaction(async (tx) => {
      const shop = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE
      `;
      if (!shop?.length) {
        throw new NotFoundException(resourceNotFound('Shop', shopId));
      }

      const overdraftProbe = await probeCashOverdraft(
        tx,
        shopId,
        amount,
        dto.confirmOverdraft,
      );
      if (overdraftProbe.kind === 'overdraft') {
        return {
          kind: 'overdraft' as const,
          shortfall: overdraftProbe.shortfall,
        };
      }
      const overdraft = overdraftProbe.overdraft;
      const expenseMoment = resolveTransactionDate(dto.expenseDate);

      const expense = await tx.expense.create({
        data: {
          shopId,
          categoryId: dto.categoryId,
          amount,
          expenseDate: expenseMoment,
          description: dto.description?.trim() ? dto.description : null,
          createdById: userId,
        },
        select: { id: true },
      });

      await tx.cashMovement.create({
        data: {
          shopId,
          type: CashMovementType.EXPENSE,
          direction: CashDirection.OUT,
          amount,
          movementDate: expenseMoment,
          referenceType: ReferenceType.EXPENSE,
          referenceId: expense.id,
          isOverdraft: overdraft,
          createdById: userId,
        },
      });

      return { kind: 'created' as const };
    });

    if (outcome.kind === 'overdraft') {
      return new PurchaseOverdraftResponseDto(outcome.shortfall, 'expense');
    }
    return new StatusBaseResponseDTO(true, CREATED);
  }

  async cancelExpense(
    id: string,
    dto: CancelExpenseDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const expense = await this.prisma.expense.findFirst({
      where: { id, shopId },
      select: { id: true, status: true, amount: true },
    });
    if (!expense) {
      throw new NotFoundException(resourceNotFound('Expense', id));
    }
    if (expense.status === RecordStatus.CANCELLED) {
      throw new BadRequestException(
        cancelledRowMutationForbidden('Expense', id),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE
      `;

      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM expenses
        WHERE id = ${id} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(resourceNotFound('Expense', id));
      }
      if (locked[0].status !== RecordStatus.ACTIVE) {
        throw new BadRequestException(
          cancelledRowMutationForbidden('Expense', id),
        );
      }

      const now = new Date();

      await tx.expense.update({
        where: { id, shopId },
        data: {
          status: RecordStatus.CANCELLED,
          cancelledAt: now,
          cancelReason: dto.cancelReason,
          cancelledById: userId,
        },
      });

      const original = await tx.cashMovement.findFirst({
        where: {
          shopId,
          referenceType: ReferenceType.EXPENSE,
          referenceId: id,
          type: CashMovementType.EXPENSE,
        },
        select: { id: true },
      });
      if (!original) {
        throw new NotFoundException(
          resourceNotFound('Cash movement for expense', id),
        );
      }

      await tx.cashMovement.create({
        data: {
          shopId,
          type: CashMovementType.REVERSAL,
          direction: CashDirection.IN,
          amount: expense.amount,
          movementDate: now,
          referenceType: ReferenceType.EXPENSE,
          referenceId: id,
          reversesMovementId: original.id,
          note: dto.cancelReason,
          createdById: userId,
        },
      });
    });

    return new StatusBaseResponseDTO(true, CANCELLED);
  }

  async getExpenses(
    query: ExpenseQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseExpenseDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'expenseDate';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.ExpenseWhereInput = { shopId };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;

    const andFilters: Prisma.ExpenseWhereInput[] = [];
    if (query.from)
      andFilters.push({ expenseDate: { gte: new Date(query.from) } });
    if (query.to) andFilters.push({ expenseDate: { lte: new Date(query.to) } });
    const amountFilter = buildAmountRangeFilter(
      query.minAmount,
      query.maxAmount,
    );
    if (amountFilter) andFilters.push({ amount: amountFilter });
    const description = query.description?.trim();
    if (description) {
      andFilters.push({
        description: { contains: description, mode: 'insensitive' },
      });
    }
    andFilters.push(
      ...buildTokenizedSearchAnd<Prisma.ExpenseWhereInput>(
        query.search,
        (token) => [
          { description: { contains: token, mode: 'insensitive' } },
          { category: { name: { contains: token, mode: 'insensitive' } } },
        ],
      ),
    );
    if (andFilters.length > 0) where.AND = andFilters;

    const orderBy =
      sortBy === 'categoryName'
        ? ({ category: { name: sortOrder } } as const)
        : ({ [sortBy]: sortOrder } as const);

    const [rows, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy,
        include: EXPENSE_INCLUDE,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseExpenseDto>(
      rows.map((row) => this.toResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getExpenseById(
    id: string,
    shopId: string,
  ): Promise<ResponseExpenseDto> {
    const row = await this.prisma.expense.findFirst({
      where: { id, shopId },
      include: EXPENSE_INCLUDE,
    });
    if (!row) throw new NotFoundException(resourceNotFound('Expense', id));
    return this.toResponse(row);
  }

  private toResponse(row: ExpenseWithCategory): ResponseExpenseDto {
    return {
      id: row.id,
      shopId: row.shopId,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      amount: Number(row.amount),
      expenseDate: row.expenseDate.toISOString().slice(0, 10),
      description: row.description,
      status: row.status,
      cancelledAt: row.cancelledAt,
      cancelReason: row.cancelReason,
      cancelledById: row.cancelledById,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
