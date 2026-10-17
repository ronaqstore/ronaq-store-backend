import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { RecordStatus } from '../../generated/prisma/enums.js';
import { CreateSupplierDto } from '../dto/create-supplier.dto.js';
import { UpdateSupplierDto } from '../dto/update-supplier.dto.js';
import { SupplierQueryFilterDto } from '../dto/supplier-query.filter.js';
import { LedgerQueryFilterDto } from '../dto/ledger-query.filter.js';
import { ResponseSupplierDto } from '../dto/response-supplier.dto.js';
import { SupplierLedgerDto } from '../dto/response-supplier-ledger.dto.js';
import { LedgerEntryDto } from '../../common-dto/response/ledger-entry.dto.js';
import { finalizePartyLedger } from '../../helpers/ledger-balance.helper.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { normalizePhone } from '../../helpers/phone.helper.js';
import {
  resourceNotFound,
  systemRowProtected,
} from '../../errors/error.builder.js';

const WALK_IN_SELLER = 'supplier';

type SupplierRow = Prisma.SupplierGetPayload<{
  select?: null;
  omit?: null;
  include?: null;
}>;

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSupplier(
    dto: CreateSupplierDto,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    await this.prisma.supplier.create({
      data: {
        shopId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
        openingBalance: BigInt(dto.openingBalance ?? 0),
        isActive: dto.isActive ?? true,
      },
    });

    return new StatusBaseResponseDTO(true, 'Supplier created successfully');
  }

  async getSuppliers(
    query: SupplierQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseSupplierDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.SupplierWhereInput = { shopId };
    if (query.isActive !== undefined && query.isActive !== null) {
      where.isActive = query.isActive;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();

      const branches: Prisma.SupplierWhereInput[] = [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { address: { contains: term, mode: 'insensitive' } },
      ];

      const canonical = normalizePhone(term);
      if (canonical && canonical !== term) {
        branches.push({ phone: { contains: canonical, mode: 'insensitive' } });
      }
      where.OR = branches;
    }

    const [rows, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseSupplierDto>(
      rows.map((row) => this.toResponse(row)),
      total,
      page,
      pageSize,
    );
  }

  async getSupplierById(
    id: string,
    shopId: string,
  ): Promise<ResponseSupplierDto> {
    const row = await this.prisma.supplier.findFirst({ where: { id, shopId } });
    if (!row) {
      throw new NotFoundException(resourceNotFound('Supplier', id));
    }
    return this.toResponse(row);
  }

  async getSupplierLedger(
    id: string,
    query: LedgerQueryFilterDto,
    shopId: string,
  ): Promise<SupplierLedgerDto> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      200,
    );

    const supplier = await this.prisma.supplier.findFirst({
      where: { id, shopId },
      select: { id: true, name: true, openingBalance: true },
    });
    if (!supplier) {
      throw new NotFoundException(resourceNotFound('Supplier', id));
    }

    const [purchases, payments] = await Promise.all([
      this.prisma.purchase.findMany({
        where: { shopId, supplierId: id, isOpeningStock: false },
        select: {
          id: true,
          purchaseNo: true,
          purchaseDate: true,
          createdAt: true,
          totalAmount: true,
          status: true,
          notes: true,
        },
      }),
      this.prisma.supplierPayment.findMany({
        where: { shopId, supplierId: id },
        select: {
          id: true,
          purchaseId: true,
          amount: true,
          paymentDate: true,
          createdAt: true,
          status: true,
          notes: true,
        },
      }),
    ]);

    const purchaseNoById = new Map(purchases.map((p) => [p.id, p.purchaseNo]));

    type RawEntry = Omit<LedgerEntryDto, 'amount' | 'delta' | 'balance'> & {
      sortAt: number;
      createdAt: number;
      amount: bigint;
      delta: bigint;
    };

    const raws: RawEntry[] = [
      ...purchases.map<RawEntry>((p) => ({
        id: p.id,
        type: 'PURCHASE',
        date: p.purchaseDate.toISOString().slice(0, 10),
        reference: p.purchaseNo,
        notes: p.notes,
        status: p.status,
        sortAt: p.purchaseDate.getTime(),
        createdAt: p.createdAt.getTime(),
        amount: p.totalAmount,
        delta: p.status === RecordStatus.ACTIVE ? p.totalAmount : 0n,
      })),
      ...payments.map<RawEntry>((p) => ({
        id: p.id,
        type: 'SUPPLIER_PAYMENT',
        date: p.paymentDate.toISOString().slice(0, 10),

        reference: p.purchaseId
          ? (purchaseNoById.get(p.purchaseId) ?? null)
          : null,
        notes: p.notes,
        status: p.status,
        sortAt: p.paymentDate.getTime(),
        createdAt: p.createdAt.getTime(),
        amount: p.amount,
        delta: p.status === RecordStatus.ACTIVE ? -p.amount : 0n,
      })),
    ];

    return finalizePartyLedger(
      raws,
      ({ id, type, date, reference, notes, status, amount, delta }) => ({
        id,
        type,
        date,
        reference,
        notes,
        status,
        amount,
        delta,
      }),
      supplier.openingBalance,
      page,
      pageSize,
      {
        supplierId: supplier.id,
        supplierName: supplier.name,
      },
    );
  }

  async updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, shopId },
    });
    if (!existing) {
      throw new NotFoundException(resourceNotFound('Supplier', id));
    }

    const newName = dto.name?.trim();

    if (existing.isSystem) {
      if (newName !== undefined && newName !== existing.name) {
        throw new ForbiddenException(systemRowProtected(WALK_IN_SELLER));
      }
      if (dto.isActive === false) {
        throw new ForbiddenException(systemRowProtected(WALK_IN_SELLER));
      }
    }

    const data: Prisma.SupplierUpdateInput = {};
    if (newName !== undefined) data.name = newName;
    if (dto.phone !== undefined) data.phone = dto.phone?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.openingBalance !== undefined) {
      data.openingBalance = BigInt(dto.openingBalance);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      return new StatusBaseResponseDTO(true, 'Supplier updated successfully');
    }

    await this.prisma.supplier.update({ where: { id }, data });

    return new StatusBaseResponseDTO(true, 'Supplier updated successfully');
  }

  async deleteSupplier(
    id: string,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, shopId },
    });
    if (!existing) {
      throw new NotFoundException(resourceNotFound('Supplier', id));
    }
    if (existing.isSystem) {
      throw new ForbiddenException(systemRowProtected(WALK_IN_SELLER));
    }

    await this.prisma.supplier.updateMany({
      where: { id, shopId },
      data: { isActive: false },
    });

    return new StatusBaseResponseDTO(true, 'Supplier deactivated successfully');
  }

  private toResponse(row: SupplierRow): ResponseSupplierDto {
    return {
      id: row.id,
      shopId: row.shopId,
      name: row.name,
      phone: row.phone,
      address: row.address,
      notes: row.notes,
      openingBalance: Number(row.openingBalance),
      isSystem: row.isSystem,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
