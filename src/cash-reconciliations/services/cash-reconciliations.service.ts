import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CashReconciliation, Prisma } from '../../generated/prisma/client.js';
import {
  CashDirection,
  CashMovementType,
  ReferenceType,
} from '../../generated/prisma/enums.js';
import { CreateCashReconciliationDto } from '../dto/create-cash-reconciliation.dto.js';
import { CashReconciliationQueryFilterDto } from '../dto/cash-reconciliation-query.filter.js';
import { ResponseCashReconciliationDto } from '../dto/response-cash-reconciliation.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { aggregateCurrentCash } from '../../helpers/cash-balance.helper.js';
import { buildTokenizedSearchAnd } from '../../helpers/tokenized-search.helper.js';
import { businessDayRange, businessToday } from '../../helpers/date.helper.js';
import {
  cashReconciliationReasonRequired,
  resourceNotFound,
} from '../../errors/error.builder.js';

const CREATED = 'Cash reconciliation recorded successfully';

@Injectable()
export class CashReconciliationsService {
  private readonly logger = new Logger(CashReconciliationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createReconciliation(
    dto: CreateCashReconciliationDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const reason = dto.reason?.trim() ? dto.reason : null;

    await this.prisma.$transaction(async (tx) => {
      const shop = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM shops WHERE id = ${shopId} FOR UPDATE
      `;
      if (!shop?.length) {
        throw new NotFoundException(resourceNotFound('Shop', shopId));
      }

      const countedCash = BigInt(dto.countedCash);
      const systemCash = BigInt(await aggregateCurrentCash(tx, shopId));
      const difference = countedCash - systemCash;

      if (difference !== 0n && !reason) {
        throw new BadRequestException(cashReconciliationReasonRequired());
      }

      const reconciliation = await tx.cashReconciliation.create({
        data: {
          shopId,
          systemCash,
          countedCash,
          difference,
          reason,
          createdById: userId,
        },
        select: { id: true },
      });

      if (difference !== 0n) {
        const absolute = difference < 0n ? -difference : difference;
        const now = new Date();
        await tx.cashMovement.create({
          data: {
            shopId,
            type: CashMovementType.RECONCILIATION_ADJUSTMENT,
            direction: difference > 0n ? CashDirection.IN : CashDirection.OUT,
            amount: absolute,
            movementDate: now,
            referenceType: ReferenceType.RECONCILIATION,
            referenceId: reconciliation.id,
            createdById: userId,
          },
        });
      }
    });

    return new StatusBaseResponseDTO(true, CREATED);
  }

  async getReconciliations(
    query: CashReconciliationQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseCashReconciliationDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'reconciledAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.CashReconciliationWhereInput = { shopId };
    const andFilters: Prisma.CashReconciliationWhereInput[] = [
      ...buildTokenizedSearchAnd<Prisma.CashReconciliationWhereInput>(
        query.search,
        (token) => [{ reason: { contains: token, mode: 'insensitive' } }],
      ),
    ];
    if (query.from)
      andFilters.push({
        reconciledAt: { gte: businessDayRange(query.from).start },
      });
    if (query.to)
      andFilters.push({
        reconciledAt: { lt: businessDayRange(query.to).end },
      });
    if (andFilters.length > 0) where.AND = andFilters;

    const [rows, total] = await Promise.all([
      this.prisma.cashReconciliation.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.cashReconciliation.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseCashReconciliationDto>(
      rows.map((row) => this.toResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getReconciliationById(
    id: string,
    shopId: string,
  ): Promise<ResponseCashReconciliationDto> {
    const row = await this.prisma.cashReconciliation.findFirst({
      where: { id, shopId },
    });
    if (!row)
      throw new NotFoundException(resourceNotFound('Reconciliation', id));
    return this.toResponse(row);
  }

  private toResponse(row: CashReconciliation): ResponseCashReconciliationDto {
    return {
      id: row.id,
      shopId: row.shopId,
      systemCash: Number(row.systemCash),
      countedCash: Number(row.countedCash),
      difference: Number(row.difference),
      reason: row.reason,
      reconciledAt: row.reconciledAt,
      createdById: row.createdById,
    };
  }
}
