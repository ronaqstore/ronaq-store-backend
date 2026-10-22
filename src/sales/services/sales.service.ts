import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CashDirection,
  CashMovementType,
  ReferenceType,
} from '../../generated/prisma/enums.js';
import { CreateSaleDto } from '../dto/create-sale.dto.js';
import { CancelSaleDto } from '../dto/cancel-sale.dto.js';
import { SaleQueryFilterDto } from '../dto/sale-query.filter.js';
import { ResponseSaleDto } from '../dto/response-sale.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { CancelImpactResponseDto } from '../../common-dto/response/cancel-impact.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  customerRequiredForSale,
  discountExceedsSubtotal,
  resourceNotFound,
  salePaidExceedsTotal,
} from '../../errors/error.builder.js';
import {
  isUniqueConstraintViolation,
  violatedColumn,
} from '../../helpers/prisma-error-helper.js';
import { SALE_INCLUDE, mapSaleToResponse } from '../helpers/sale.mapper.js';
import {
  buildSaleListWhere,
  buildSaleMoneyFilterSql,
  buildSaleMoneyOrderedIdsSql,
  saleListNeedsMoneyJoin,
} from '../helpers/sale-list-where.helper.js';
import {
  SalesLineWriterService,
  type LockedSaleLine,
} from './sales-line-writer.service.js';
import {
  SalesCancelService,
  type CancelSaleResult,
} from './sales-cancel.service.js';

export type { CancelSaleResult } from './sales-cancel.service.js';

const CREATED = 'Sale created successfully';
const ALREADY_SAVED = 'Sale already saved';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lineWriter: SalesLineWriterService,
    private readonly cancelFlow: SalesCancelService,
  ) {}

  async createSale(
    dto: CreateSaleDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const existing = await this.prisma.sale.findFirst({
      where: { shopId, clientRequestId: dto.clientRequestId },
      select: { id: true },
    });
    if (existing) {
      return new StatusBaseResponseDTO(true, ALREADY_SAVED);
    }

    const customerId = dto.customerId ?? null;
    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, shopId },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException(resourceNotFound('Customer', customerId));
      }
    }

    const lines = await this.lineWriter.validateLines(dto, shopId);

    const subtotal = lines.reduce(
      (sum, line) => sum + BigInt(line.quantity) * BigInt(line.unitPrice),
      0n,
    );
    const discount = BigInt(dto.discount ?? 0);
    if (discount > subtotal) {
      throw new BadRequestException(
        discountExceedsSubtotal(Number(discount), Number(subtotal)),
      );
    }
    const totalAmount = subtotal - discount;
    const paidNow = BigInt(dto.paidNow ?? 0);
    if (paidNow > totalAmount) {
      throw new BadRequestException(
        salePaidExceedsTotal(Number(totalAmount), Number(paidNow)),
      );
    }

    const hasPhone = lines.some((line) => line.inventoryUnitId);
    const outstanding = totalAmount - paidNow;
    if ((hasPhone || outstanding > 0n) && !customerId) {
      throw new BadRequestException(customerRequiredForSale());
    }

    const saleMoment = new Date(dto.saleDate);

    try {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ next: number }>>`
          UPDATE shops SET next_sale_no = next_sale_no + 1
          WHERE id = ${shopId}
          RETURNING next_sale_no - 1 AS next
        `;
        if (!rows?.length) {
          throw new NotFoundException(resourceNotFound('Shop', shopId));
        }

        const lockedLines: LockedSaleLine[] = [];
        for (const line of lines) {
          lockedLines.push(
            line.inventoryUnitId
              ? await this.lineWriter.lockPhoneLine(tx, line, shopId)
              : await this.lineWriter.lockQuantityLine(tx, line, shopId),
          );
        }

        const sale = await tx.sale.create({
          data: {
            shopId,
            customerId,
            saleNo: `S-${String(rows[0].next).padStart(4, '0')}`,
            saleDate: saleMoment,
            subtotal,
            discount,
            totalAmount,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            clientRequestId: dto.clientRequestId,
            notes: dto.notes?.trim() ? dto.notes : null,
            createdById: userId,
          },
          select: { id: true },
        });

        for (const locked of lockedLines) {
          await this.lineWriter.writeLine(tx, locked, sale.id, shopId);
        }

        if (paidNow > 0n) {
          const payment = await tx.payment.create({
            data: {
              shopId,
              customerId,
              saleId: sale.id,
              amount: paidNow,
              paymentDate: saleMoment,
              clientRequestId: dto.clientRequestId,
              createdById: userId,
            },
            select: { id: true },
          });
          await tx.cashMovement.create({
            data: {
              shopId,
              type: CashMovementType.CUSTOMER_PAYMENT,
              direction: CashDirection.IN,
              amount: paidNow,
              movementDate: saleMoment,
              referenceType: ReferenceType.PAYMENT,
              referenceId: payment.id,
              createdById: userId,
            },
          });
        }
      });
    } catch (error) {
      if (
        isUniqueConstraintViolation(error) &&
        violatedColumn(error, 'client_request_id')
      ) {
        return new StatusBaseResponseDTO(true, ALREADY_SAVED);
      }
      throw error;
    }

    return new StatusBaseResponseDTO(true, CREATED);
  }

  cancelSale(
    id: string,
    dto: CancelSaleDto,
    shopId: string,
    userId: string,
  ): Promise<CancelSaleResult> {
    return this.cancelFlow.cancelSale(id, dto, shopId, userId);
  }

  getCancelImpact(
    id: string,
    shopId: string,
  ): Promise<CancelImpactResponseDto> {
    return this.cancelFlow.getCancelImpact(id, shopId);
  }

  async getSales(
    query: SaleQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseSaleDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'saleDate';
    const sortOrder = query.sortOrder ?? 'desc';

    let where = buildSaleListWhere(query, shopId);
    const moneySort =
      sortBy === 'paid' || sortBy === 'outstanding' ? sortBy : null;

    if (saleListNeedsMoneyJoin(query)) {
      const matched = await this.prisma.$queryRaw<Array<{ id: string }>>(
        moneySort
          ? buildSaleMoneyOrderedIdsSql(query, shopId, moneySort, sortOrder)
          : buildSaleMoneyFilterSql(query, shopId),
      );
      const orderedIds = matched.map((row) => row.id);
      where = { shopId, id: { in: orderedIds } };

      if (moneySort) {
        const total = orderedIds.length;
        const pageIds = orderedIds.slice(
          getSkipNumber(page, pageSize),
          getSkipNumber(page, pageSize) + pageSize,
        );
        if (pageIds.length === 0) {
          return new PaginatedResponseDTO<ResponseSaleDto>(
            [],
            total,
            page,
            pageSize,
          );
        }
        const rows = await this.prisma.sale.findMany({
          where: { shopId, id: { in: pageIds } },
          include: SALE_INCLUDE,
        });
        const byId = new Map(rows.map((row) => [row.id, row]));
        return new PaginatedResponseDTO<ResponseSaleDto>(
          pageIds
            .map((id) => byId.get(id))
            .filter((row): row is NonNullable<typeof row> => row != null)
            .map((row) => mapSaleToResponse(row)),
          total,
          page,
          pageSize,
        );
      }
    }

    const prismaSortBy =
      sortBy === 'paid' || sortBy === 'outstanding' ? 'saleDate' : sortBy;

    const [rows, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [prismaSortBy]: sortOrder },
        include: SALE_INCLUDE,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseSaleDto>(
      rows.map((row) => mapSaleToResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getSaleById(id: string, shopId: string): Promise<ResponseSaleDto> {
    const row = await this.prisma.sale.findFirst({
      where: { id, shopId },
      include: SALE_INCLUDE,
    });
    if (!row) throw new NotFoundException(resourceNotFound('Sale', id));
    return mapSaleToResponse(row);
  }
}
