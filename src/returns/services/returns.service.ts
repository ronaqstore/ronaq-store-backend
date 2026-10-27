import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  CashDirection,
  CashMovementType,
  PaymentMethod,
  RecordStatus,
  ReferenceType,
  ReturnCondition,
} from '../../generated/prisma/enums.js';
import { CreateReturnDto } from '../dto/create-return.dto.js';
import { ReturnPreviewDto } from '../dto/return-preview.dto.js';
import { ReturnQueryFilterDto } from '../dto/return-query.filter.js';
import { ResponseReturnDto } from '../dto/response-return.dto.js';
import {
  ReturnPreviewLineDto,
  ReturnPreviewResponseDto,
} from '../dto/return-preview.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  businessDayRange,
  resolveTransactionDate,
} from '../../helpers/date.helper.js';
import {
  buildTokenizedSearchAnd,
  stripDocSearchPrefix,
} from '../../helpers/tokenized-search.helper.js';
import { aggregateCurrentCash } from '../../helpers/cash-balance.helper.js';
import { lockShopForUpdate } from '../../helpers/shop-lock.helper.js';
import {
  cancelledRowMutationForbidden,
  refundExceedsAvailable,
  resourceNotFound,
} from '../../errors/error.builder.js';
import {
  RETURN_INCLUDE,
  mapReturnToResponse,
} from '../helpers/return.mapper.js';
import { ReturnsFlowService } from './returns-flow.service.js';

const CREATED = 'Return recorded successfully';

export type CreateReturnResult =
  StatusBaseResponseDTO | PurchaseOverdraftResponseDto;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flow: ReturnsFlowService,
  ) {}

  async previewReturn(
    saleId: string,
    dto: ReturnPreviewDto,
    shopId: string,
  ): Promise<ReturnPreviewResponseDto> {
    const { sale, lines, settlement } = await this.flow.prepare(
      this.prisma,
      saleId,
      shopId,
      dto.items,
    );

    const refundAmount = BigInt(dto.refundAmount ?? 0);
    if (refundAmount > settlement.refundable) {
      throw new BadRequestException(
        refundExceedsAvailable(
          Number(refundAmount),
          Number(settlement.refundable),
        ),
      );
    }

    const outstandingAfter =
      settlement.outstandingBefore - settlement.returnAmount + refundAmount;
    const currentCash = await aggregateCurrentCash(this.prisma, shopId);
    const cashAfter = currentCash - Number(refundAmount);

    return {
      saleId: sale.id,
      saleNo: sale.saleNo,
      customerName: sale.customer?.name ?? null,
      returnAmount: Number(settlement.returnAmount),
      outstandingBefore: Number(settlement.outstandingBefore),
      outstandingAfter: Number(outstandingAfter),
      refundable: Number(settlement.refundable),
      refundAmount: Number(refundAmount),
      currentCash,
      cashAfter,
      willCauseOverdraft: cashAfter < 0,
      items: lines.map((line): ReturnPreviewLineDto => ({
        saleItemId: line.saleItemId,
        productName: line.productName,
        imei: line.imei,
        quantity: line.quantity,
        condition: line.condition,
      })),
    };
  }

  async createReturn(
    saleId: string,
    dto: CreateReturnDto,
    shopId: string,
    userId: string,
  ): Promise<CreateReturnResult> {
    const refundAmount = BigInt(dto.refundAmount ?? 0);
    const first = await this.flow.prepare(
      this.prisma,
      saleId,
      shopId,
      dto.items,
    );
    if (refundAmount > first.settlement.refundable) {
      throw new BadRequestException(
        refundExceedsAvailable(
          Number(refundAmount),
          Number(first.settlement.refundable),
        ),
      );
    }

    const returnMoment = resolveTransactionDate(dto.returnDate);

    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockShopForUpdate(tx, shopId);

      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM sales
        WHERE id = ${saleId} AND shop_id = ${shopId}
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(resourceNotFound('Sale', saleId));
      }
      if (locked[0].status !== RecordStatus.ACTIVE) {
        throw new BadRequestException(
          cancelledRowMutationForbidden('Sale', first.sale.saleNo),
        );
      }

      const fresh = await this.flow.prepare(tx, saleId, shopId, dto.items);

      let overdraft = false;
      if (refundAmount > 0n) {
        const after =
          (await aggregateCurrentCash(tx, shopId)) - Number(refundAmount);
        if (after < 0) {
          if (!dto.confirmOverdraft) {
            return { kind: 'overdraft' as const, shortfall: -after };
          }
          overdraft = true;
        }
      }

      const returnRow = await tx.saleReturn.create({
        data: {
          shopId,
          saleId,
          customerId: fresh.sale.customerId,
          returnDate: returnMoment,
          reason: dto.reason,
          returnAmount: fresh.settlement.returnAmount,
          notes: dto.notes?.trim() ? dto.notes : null,
          createdById: userId,
        },
        select: { id: true },
      });

      for (const line of fresh.lines) {
        await tx.returnItem.create({
          data: {
            shopId,
            returnId: returnRow.id,
            saleItemId: line.saleItemId,
            inventoryUnitId: line.inventoryUnitId,
            quantity: line.quantity,
            condition: line.condition,
          },
        });
      }

      for (const line of fresh.lines) {
        await this.flow.restoreLine(
          tx,
          fresh.sale,
          line,
          shopId,
          returnRow.id,
          dto.reason,
        );
        if (line.condition === ReturnCondition.DAMAGED) {
          await this.flow.writeOffLine(
            tx,
            line,
            shopId,
            returnRow.id,
            dto.reason,
          );
        }
      }

      if (refundAmount > 0n) {
        const refund = await tx.refund.create({
          data: {
            shopId,
            returnId: returnRow.id,
            amount: refundAmount,
            refundDate: returnMoment,
            method: PaymentMethod.CASH,
            notes: dto.notes?.trim() ? dto.notes : null,
            createdById: userId,
          },
          select: { id: true },
        });
        await tx.cashMovement.create({
          data: {
            shopId,
            type: CashMovementType.REFUND,
            direction: CashDirection.OUT,
            amount: refundAmount,
            movementDate: returnMoment,
            referenceType: ReferenceType.REFUND,
            referenceId: refund.id,
            isOverdraft: overdraft,
            note: dto.reason,
            createdById: userId,
          },
        });
      }

      return { kind: 'created' as const };
    });

    if (outcome.kind === 'overdraft') {
      return new PurchaseOverdraftResponseDto(outcome.shortfall, 'refund');
    }
    return new StatusBaseResponseDTO(true, CREATED);
  }

  async getReturns(
    query: ReturnQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseReturnDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'returnDate';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.SaleReturnWhereInput = { shopId };
    if (query.saleId) where.saleId = query.saleId;
    if (query.customerId) where.customerId = query.customerId;
    const dateFilters: Prisma.SaleReturnWhereInput[] = [];
    if (query.from)
      dateFilters.push({
        returnDate: { gte: businessDayRange(query.from).start },
      });
    if (query.to)
      dateFilters.push({ returnDate: { lt: businessDayRange(query.to).end } });
    if (dateFilters.length > 0) where.AND = dateFilters;
    const returnSearchAnd =
      buildTokenizedSearchAnd<Prisma.SaleReturnWhereInput>(
        query.search,
        (token) => {
          const saleTerm = stripDocSearchPrefix(token);
          return [
            { sale: { saleNo: { contains: saleTerm, mode: 'insensitive' } } },
            { customer: { name: { contains: token, mode: 'insensitive' } } },
            { reason: { contains: token, mode: 'insensitive' } },
          ];
        },
      );
    if (returnSearchAnd.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        ...returnSearchAnd,
      ];
    }

    const orderBy =
      sortBy === 'returnDate'
        ? [
            { returnDate: sortOrder },
            { createdAt: sortOrder },
            { id: sortOrder },
          ]
        : [
            { [sortBy]: sortOrder },
            { returnDate: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ];

    const [rows, total] = await Promise.all([
      this.prisma.saleReturn.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy,
        include: RETURN_INCLUDE,
      }),
      this.prisma.saleReturn.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseReturnDto>(
      rows.map((row) => mapReturnToResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getReturnById(id: string, shopId: string): Promise<ResponseReturnDto> {
    const row = await this.prisma.saleReturn.findFirst({
      where: { id, shopId },
      include: RETURN_INCLUDE,
    });
    if (!row) throw new NotFoundException(resourceNotFound('Return', id));
    return mapReturnToResponse(row);
  }
}
