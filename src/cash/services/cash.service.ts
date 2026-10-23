import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma, CashMovement } from '../../generated/prisma/client.js';
import {
  CashDirection,
  CashMovementType,
} from '../../generated/prisma/enums.js';
import { CreateOpeningCashDto } from '../dto/create-opening-cash.dto.js';
import { CreateOwnerInvestmentDto } from '../dto/create-owner-investment.dto.js';
import { CreateOwnerWithdrawalDto } from '../dto/create-owner-withdrawal.dto.js';
import { CashMovementQueryFilterDto } from '../dto/cash-movement-query.filter.js';
import { ResponseCashMovementDto } from '../dto/response-cash-movement.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import { probeCashOverdraft } from '../../helpers/cash-balance.helper.js';
import { lockShopForUpdate } from '../../helpers/shop-lock.helper.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { businessDayRange, businessToday } from '../../helpers/date.helper.js';
import { openingCashAlreadySet } from '../../errors/error.builder.js';
import { buildAmountRangeFilter } from '../../common-dto/helpers/amount-range-filter.helper.js';
import { splitSearchTokens } from '../../helpers/tokenized-search.helper.js';

const CREATED = 'Opening cash recorded successfully';
const INVESTED = 'Owner investment recorded successfully';
const WITHDRAWN = 'Owner withdrawal recorded successfully';

export function extractCashSearchDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

export type OwnerWithdrawalResult =
  StatusBaseResponseDTO | PurchaseOverdraftResponseDto;

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOpeningCash(
    dto: CreateOpeningCashDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const amount = BigInt(dto.amount);
    const movementDate = new Date(dto.date ?? businessToday());
    const note = dto.notes?.trim() ? dto.notes : null;

    await this.prisma.$transaction(async (tx) => {
      await lockShopForUpdate(tx, shopId);

      const existing = await tx.cashMovement.findFirst({
        where: { shopId, type: CashMovementType.OPENING_CASH },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException(openingCashAlreadySet());
      }

      await tx.cashMovement.create({
        data: {
          shopId,
          type: CashMovementType.OPENING_CASH,
          direction: CashDirection.IN,
          amount,
          movementDate,
          note,
          createdById: userId,
        },
      });
    });

    return new StatusBaseResponseDTO(true, CREATED);
  }

  async createOwnerInvestment(
    dto: CreateOwnerInvestmentDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    await this.prisma.cashMovement.create({
      data: {
        shopId,
        type: CashMovementType.OWNER_INVESTMENT,
        direction: CashDirection.IN,
        amount: BigInt(dto.amount),
        movementDate: new Date(dto.date ?? businessToday()),
        note: dto.notes?.trim() ? dto.notes : null,
        createdById: userId,
      },
    });

    return new StatusBaseResponseDTO(true, INVESTED);
  }

  async createOwnerWithdrawal(
    dto: CreateOwnerWithdrawalDto,
    shopId: string,
    userId: string,
  ): Promise<OwnerWithdrawalResult> {
    const amount = BigInt(dto.amount);

    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockShopForUpdate(tx, shopId);

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

      await tx.cashMovement.create({
        data: {
          shopId,
          type: CashMovementType.OWNER_WITHDRAWAL,
          direction: CashDirection.OUT,
          amount,
          movementDate: new Date(dto.date ?? businessToday()),
          note: dto.notes?.trim() ? dto.notes : null,
          isOverdraft: overdraft,
          createdById: userId,
        },
      });

      return { kind: 'created' as const };
    });

    if (outcome.kind === 'overdraft') {
      return new PurchaseOverdraftResponseDto(outcome.shortfall, 'withdrawal');
    }
    return new StatusBaseResponseDTO(true, WITHDRAWN);
  }

  async getCashMovements(
    query: CashMovementQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseCashMovementDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'movementDate';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.CashMovementWhereInput = { shopId };
    if (query.type) where.type = query.type;
    if (query.direction) where.direction = query.direction;

    const andFilters: Prisma.CashMovementWhereInput[] = [];
    if (query.from)
      andFilters.push({
        movementDate: { gte: businessDayRange(query.from).start },
      });
    if (query.to)
      andFilters.push({
        movementDate: { lt: businessDayRange(query.to).end },
      });

    const amountFilter = buildAmountRangeFilter(
      query.minAmount,
      query.maxAmount,
    );
    if (amountFilter) andFilters.push({ amount: amountFilter });

    const note = query.note?.trim();
    if (note) {
      andFilters.push({ note: { contains: note, mode: 'insensitive' } });
    }

    for (const token of splitSearchTokens(query.search)) {
      const searchOr: Prisma.CashMovementWhereInput[] = [
        { note: { contains: token, mode: 'insensitive' } },
      ];

      const digits = extractCashSearchDigits(token);
      if (digits) {
        const amountHits = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM cash_movements
          WHERE shop_id = ${shopId}
            AND (
              CAST((amount / 100) AS TEXT) LIKE ${'%' + digits + '%'}
              OR CAST(amount AS TEXT) LIKE ${'%' + digits + '%'}
            )
        `;
        if (amountHits.length > 0) {
          searchOr.push({ id: { in: amountHits.map((row) => row.id) } });
        }
      }

      andFilters.push({ OR: searchOr });
    }

    if (andFilters.length > 0) where.AND = andFilters;

    const [rows, total] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.cashMovement.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseCashMovementDto>(
      rows.map((row) => this.toResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  private toResponse(row: CashMovement): ResponseCashMovementDto {
    return {
      id: row.id,
      shopId: row.shopId,
      type: row.type,
      direction: row.direction,
      amount: Number(row.amount),
      movementDate: row.movementDate.toISOString(),
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      reversesMovementId: row.reversesMovementId,
      isOverdraft: row.isOverdraft,
      note: row.note,
      createdById: row.createdById,
      createdAt: row.createdAt,
    };
  }
}
