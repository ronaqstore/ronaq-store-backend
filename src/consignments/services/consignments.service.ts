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
  ConsignmentStatus,
  InventoryMovementType,
  PaymentMethod,
  ReferenceType,
  UnitCondition,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { CreateConsignmentDto } from '../dto/create-consignment.dto.js';
import { SettleConsignmentDto } from '../dto/settle-consignment.dto.js';
import { ReturnConsignmentDto } from '../dto/return-consignment.dto.js';
import { CancelConsignmentDto } from '../dto/cancel-consignment.dto.js';
import { ConsignmentQueryFilterDto } from '../dto/consignment-query.filter.js';
import { ResponseConsignmentDto } from '../dto/response-consignment.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import { probeCashOverdraft } from '../../helpers/cash-balance.helper.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { resolveDateOnly } from '../../helpers/date.helper.js';
import { isAppleBrandName } from '../../helpers/device-family.helper.js';
import {
  batteryHealthNotAllowed,
  batteryHealthOutOfRange,
  consignmentNotAvailableForCancellation,
  consignmentNotAvailableForReturn,
  consignmentNotAvailableForSettlement,
  consignmentNotFound,
  duplicateImei,
  imeiPairMustDiffer,
  resourceNotFound,
} from '../../errors/error.builder.js';
import {
  CONSIGNMENT_INCLUDE,
  mapConsignmentToResponse,
} from '../helpers/consignment.mapper.js';

export type SettleConsignmentResult =
  ResponseConsignmentDto | PurchaseOverdraftResponseDto;

const RETURNED = 'Consignment returned to owner successfully';
const CANCELLED = 'Consignment cancelled successfully';

@Injectable()
export class ConsignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createConsignment(
    dto: CreateConsignmentDto,
    shopId: string,
    userId: string,
  ): Promise<ResponseConsignmentDto> {
    const existing = await this.prisma.consignment.findFirst({
      where: { shopId, clientRequestId: dto.clientRequestId },
      select: { id: true },
    });
    if (existing) {
      return this.getConsignmentById(existing.id, shopId);
    }

    if (dto.imei2 && dto.imei1 === dto.imei2) {
      throw new BadRequestException(imeiPairMustDiffer(dto.imei1));
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, shopId },
      select: {
        id: true,
        name: true,
        trackingType: true,
        brand: { select: { name: true } },
      },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', dto.productId));
    }
    if (product.trackingType !== 'SERIALIZED') {
      throw new BadRequestException(
        'Consignment is only supported for serialized phones',
      );
    }

    if (dto.batteryHealth != null) {
      if (!isAppleBrandName(product.brand?.name ?? null)) {
        throw new BadRequestException(batteryHealthNotAllowed(product.name));
      }
      if (dto.batteryHealth < 1 || dto.batteryHealth > 100) {
        throw new BadRequestException(batteryHealthOutOfRange());
      }
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, shopId },
        select: { id: true },
      });
      if (!customer) {
        throw new NotFoundException(
          resourceNotFound('Customer', dto.customerId),
        );
      }
    }

    const imeisToCheck = [dto.imei1, dto.imei2].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );

    const inUse = await this.prisma.inventoryUnit.findFirst({
      where: {
        shopId,
        status: UnitStatus.IN_STOCK,
        OR: [{ imei1: { in: imeisToCheck } }, { imei2: { in: imeisToCheck } }],
      },
      select: { imei1: true, imei2: true },
    });
    if (inUse) {
      const hit =
        imeisToCheck.find((v) => v === inUse.imei1 || v === inUse.imei2) ??
        inUse.imei1;
      throw new BadRequestException(duplicateImei(hit));
    }

    const intakeDate = resolveDateOnly(dto.intakeDate);
    const agreedPayout = BigInt(dto.agreedPayout);
    const targetSellingPrice =
      dto.targetSellingPrice != null ? BigInt(dto.targetSellingPrice) : null;
    const condition = (dto.condition as UnitCondition) ?? UnitCondition.USED;

    const result = await this.prisma.$transaction(async (tx) => {
      const shopRows = await tx.$queryRaw<Array<{ next: number }>>`
        UPDATE shops SET next_consignment_no = next_consignment_no + 1
        WHERE id = ${shopId}::uuid
        RETURNING next_consignment_no - 1 AS next
      `;
      const nextNo = shopRows[0]?.next ?? 1;
      const consignmentNo = `CON-${String(nextNo).padStart(4, '0')}`;

      const created = await tx.consignment.create({
        data: {
          shopId,
          consignmentNo,
          customerId: dto.customerId ?? null,
          consignorName: dto.consignorName.trim(),
          consignorPhone: dto.consignorPhone.trim(),
          consignorCnic: dto.consignorCnic?.trim()
            ? dto.consignorCnic.trim()
            : null,
          productId: dto.productId,
          imei1: dto.imei1.trim(),
          imei2: dto.imei2?.trim() || null,
          condition,
          batteryHealth: dto.batteryHealth ?? null,
          defectNotes: dto.defectNotes?.trim() ? dto.defectNotes.trim() : null,
          agreedPayout,
          targetSellingPrice,
          status: ConsignmentStatus.IN_CUSTODY,
          intakeDate,
          clientRequestId: dto.clientRequestId,
          notes: dto.notes?.trim() ? dto.notes.trim() : null,
          createdById: userId,
        },
      });

      const unit = await tx.inventoryUnit.create({
        data: {
          shopId,
          productId: dto.productId,
          consignmentId: created.id,
          purchaseItemId: null,
          imei1: dto.imei1.trim(),
          imei2: dto.imei2?.trim() || null,
          condition,
          unitCost: agreedPayout,
          askingPrice: targetSellingPrice,
          batteryHealth: dto.batteryHealth ?? null,
          defectNotes: dto.defectNotes?.trim() ? dto.defectNotes.trim() : null,
          status: UnitStatus.IN_STOCK,
        },
      });

      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId: dto.productId,
          inventoryUnitId: unit.id,
          type: InventoryMovementType.CONSIGNMENT_INTAKE,
          quantityChange: 1,
          referenceType: ReferenceType.CONSIGNMENT,
          referenceId: created.id,
        },
      });

      return created;
    });

    return this.getConsignmentById(result.id, shopId);
  }

  async getConsignmentById(
    id: string,
    shopId: string,
  ): Promise<ResponseConsignmentDto> {
    const row = await this.prisma.consignment.findFirst({
      where: { id, shopId },
      include: CONSIGNMENT_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(consignmentNotFound(id));
    }
    return mapConsignmentToResponse(row);
  }

  async listConsignments(
    filter: ConsignmentQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseConsignmentDto>> {
    const { page, pageSize } = normalizePagination(
      filter.page,
      filter.pageSize,
    );
    const skip = getSkipNumber(page, pageSize);

    const where: Prisma.ConsignmentWhereInput = {
      shopId,
    };

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.productId) {
      where.productId = filter.productId;
    }
    if (filter.customerId) {
      where.customerId = filter.customerId;
    }
    if (filter.fromDate || filter.toDate) {
      where.intakeDate = {};
      if (filter.fromDate) {
        where.intakeDate.gte = resolveDateOnly(filter.fromDate);
      }
      if (filter.toDate) {
        where.intakeDate.lte = resolveDateOnly(filter.toDate);
      }
    }

    if (filter.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { consignmentNo: { contains: q, mode: 'insensitive' } },
        { consignorName: { contains: q, mode: 'insensitive' } },
        { consignorPhone: { contains: q, mode: 'insensitive' } },
        { consignorCnic: { contains: q, mode: 'insensitive' } },
        { imei1: { contains: q, mode: 'insensitive' } },
        { imei2: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.consignment.count({ where }),
      this.prisma.consignment.findMany({
        where,
        include: CONSIGNMENT_INCLUDE,
        orderBy: { intakeDate: filter.sortOrder ?? 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    return new PaginatedResponseDTO<ResponseConsignmentDto>(
      rows.map(mapConsignmentToResponse),
      page,
      pageSize,
      total,
    );
  }

  async returnConsignment(
    id: string,
    dto: ReturnConsignmentDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    return this.prisma.$transaction(async (tx) => {
      const con = await this.lockInCustodyConsignment(tx, id, shopId);
      if (con.status !== ConsignmentStatus.IN_CUSTODY) {
        throw new BadRequestException(
          consignmentNotAvailableForReturn(con.consignment_no, con.status),
        );
      }

      await this.voidInCustodyUnit(
        tx,
        con.id,
        con.product_id,
        shopId,
        InventoryMovementType.CONSIGNMENT_RETURN,
        dto.returnReason.trim(),
      );

      await tx.consignment.update({
        where: { id },
        data: {
          status: ConsignmentStatus.RETURNED_TO_OWNER,
          returnedAt: new Date(),
          returnedById: userId,
          returnReason: dto.returnReason.trim(),
          notes: dto.notes?.trim() ? dto.notes.trim() : undefined,
        },
      });

      return new StatusBaseResponseDTO(true, RETURNED, id);
    });
  }

  async settleConsignment(
    id: string,
    dto: SettleConsignmentDto,
    shopId: string,
    userId: string,
  ): Promise<SettleConsignmentResult> {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          consignment_no: string;
          status: string;
          agreed_payout: bigint;
          consignor_name: string;
          sale_item_id: string | null;
        }>
      >`
        SELECT id, consignment_no, status, agreed_payout, consignor_name, sale_item_id FROM consignments
        WHERE id = ${id}::uuid AND shop_id = ${shopId}::uuid
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(consignmentNotFound(id));
      }
      const con = locked[0];
      if (con.status !== ConsignmentStatus.SOLD) {
        throw new BadRequestException(
          consignmentNotAvailableForSettlement(con.consignment_no, con.status),
        );
      }

      const payout =
        dto.settledAmount != null
          ? BigInt(dto.settledAmount)
          : BigInt(con.agreed_payout);

      if (dto.payoutMethod === PaymentMethod.CASH && payout > 0n) {
        const probe = await probeCashOverdraft(
          tx,
          shopId,
          payout,
          dto.confirmOverdraft,
        );
        if (probe.kind === 'overdraft') {
          return new PurchaseOverdraftResponseDto(probe.shortfall);
        }

        await tx.cashMovement.create({
          data: {
            shopId,
            type: CashMovementType.CONSIGNMENT_PAYOUT,
            direction: CashDirection.OUT,
            amount: payout,
            movementDate: new Date(),
            referenceType: ReferenceType.CONSIGNMENT,
            referenceId: id,
            isOverdraft: probe.overdraft,
            clientRequestId: dto.clientRequestId,
            note: dto.notes?.trim()
              ? dto.notes.trim()
              : `Consignment payout: ${con.consignment_no} to ${con.consignor_name}`,
            createdById: userId,
          },
        });
      }

      await tx.consignment.update({
        where: { id },
        data: {
          status: ConsignmentStatus.SETTLED,
          settledAt: new Date(),
          settledById: userId,
          settledAmount: payout,
          payoutMethod: dto.payoutMethod,
          payoutReference: dto.payoutReference?.trim()
            ? dto.payoutReference.trim()
            : null,
          notes: dto.notes?.trim() ? dto.notes.trim() : undefined,
        },
      });

      if (con.sale_item_id) {
        await tx.saleItem.update({
          where: { id: con.sale_item_id },
          data: { unitCost: payout },
        });
      }

      await tx.inventoryUnit.updateMany({
        where: { consignmentId: id, shopId },
        data: { unitCost: payout },
      });

      return { id };
    });

    if (outcome instanceof PurchaseOverdraftResponseDto) {
      return outcome;
    }

    return this.getConsignmentById(id, shopId);
  }

  async cancelConsignment(
    id: string,
    dto: CancelConsignmentDto,
    shopId: string,
    userId: string,
  ): Promise<StatusBaseResponseDTO> {
    return this.prisma.$transaction(async (tx) => {
      const con = await this.lockInCustodyConsignment(tx, id, shopId);
      if (con.status !== ConsignmentStatus.IN_CUSTODY) {
        throw new BadRequestException(
          consignmentNotAvailableForCancellation(
            con.consignment_no,
            con.status,
          ),
        );
      }

      await this.voidInCustodyUnit(
        tx,
        con.id,
        con.product_id,
        shopId,
        InventoryMovementType.ADJUSTMENT,
        dto.cancelReason.trim(),
      );

      await tx.consignment.update({
        where: { id },
        data: {
          status: ConsignmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById: userId,
          cancelReason: dto.cancelReason.trim(),
          notes: dto.notes?.trim() ? dto.notes.trim() : undefined,
        },
      });

      return new StatusBaseResponseDTO(true, CANCELLED, id);
    });
  }

  private async lockInCustodyConsignment(
    tx: Prisma.TransactionClient,
    id: string,
    shopId: string,
  ): Promise<{
    id: string;
    consignment_no: string;
    status: string;
    product_id: string;
  }> {
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        consignment_no: string;
        status: string;
        product_id: string;
      }>
    >`
      SELECT id, consignment_no, status, product_id FROM consignments
      WHERE id = ${id}::uuid AND shop_id = ${shopId}::uuid
      FOR UPDATE
    `;
    if (!locked?.length) {
      throw new NotFoundException(consignmentNotFound(id));
    }
    return locked[0];
  }

  private async voidInCustodyUnit(
    tx: Prisma.TransactionClient,
    conId: string,
    productId: string,
    shopId: string,
    movementType: InventoryMovementType,
    reason: string,
  ): Promise<void> {
    const unit = await tx.inventoryUnit.findFirst({
      where: { consignmentId: conId, shopId },
      select: { id: true, status: true },
    });
    if (unit && unit.status === UnitStatus.IN_STOCK) {
      await tx.inventoryUnit.update({
        where: { id: unit.id },
        data: { status: UnitStatus.VOIDED },
      });

      await tx.inventoryMovement.create({
        data: {
          shopId,
          productId,
          inventoryUnitId: unit.id,
          type: movementType,
          quantityChange: -1,
          referenceType: ReferenceType.CONSIGNMENT,
          referenceId: conId,
          reason,
        },
      });
    }
  }
}
