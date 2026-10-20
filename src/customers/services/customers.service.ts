import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Customer, Prisma } from '../../generated/prisma/client.js';
import { RecordStatus } from '../../generated/prisma/enums.js';
import { CreateCustomerDto } from '../dto/create-customer.dto.js';
import { UpdateCustomerDto } from '../dto/update-customer.dto.js';
import { CustomerQueryFilterDto } from '../dto/customer-query.filter.js';
import { LedgerQueryFilterDto } from '../dto/ledger-query.filter.js';
import { ResponseCustomerDto } from '../dto/response-customer.dto.js';
import { CustomerLedgerDto } from '../dto/response-customer-ledger.dto.js';
import { LedgerEntryDto } from '../../common-dto/response/ledger-entry.dto.js';
import { finalizePartyLedger } from '../../helpers/ledger-balance.helper.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  normalizePhone,
  normalizePhoneOrRaw,
} from '../../helpers/phone.helper.js';
import { findLoginPhoneConflict } from '../../helpers/login-phone.helper.js';
import {
  loginPhoneAlreadyTaken,
  requiredFieldCannotBeNull,
  resourceNotFound,
} from '../../errors/error.builder.js';
import { customerCurrentBalances } from '../../helpers/party-current-balance.helper.js';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(
    dto: CreateCustomerDto,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const phone = dto.phone ? normalizePhoneOrRaw(dto.phone) : null;
    await this.assertPhoneAvailable(phone);

    await this.prisma.customer.create({
      data: {
        shopId,
        name: dto.name.trim(),
        phone,
        address: dto.address?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
        openingBalance: BigInt(dto.openingBalance ?? 0),
        isActive: dto.isActive ?? true,
      },
    });

    return new StatusBaseResponseDTO(true, 'Customer created successfully');
  }

  async getCustomers(
    query: CustomerQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseCustomerDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.CustomerWhereInput = { shopId };
    const search = query.search?.trim();
    if (search) {
      const branches: Prisma.CustomerWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];

      const canonical = normalizePhone(search);
      if (canonical && canonical !== search) {
        branches.push({ phone: { contains: canonical } });
      }
      where.OR = branches;
    }
    if (query.isActive !== undefined && query.isActive !== null) {
      where.isActive = query.isActive;
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const ledgerDeltas = await customerCurrentBalances(
      this.prisma,
      shopId,
      items.map((item) => item.id),
    );

    return new PaginatedResponseDTO<ResponseCustomerDto>(
      items.map((item) =>
        this.toResponse(item, ledgerDeltas.get(item.id) ?? 0),
      ),
      total,
      page,
      pageSize,
    );
  }

  async getCustomerById(
    id: string,
    shopId: string,
  ): Promise<ResponseCustomerDto> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, shopId },
    });
    if (!customer) {
      throw new NotFoundException(resourceNotFound('Customer', id));
    }
    const ledgerDeltas = await customerCurrentBalances(this.prisma, shopId, [
      id,
    ]);
    return this.toResponse(customer, ledgerDeltas.get(id) ?? 0);
  }

  async getCustomerLedger(
    id: string,
    query: LedgerQueryFilterDto,
    shopId: string,
  ): Promise<CustomerLedgerDto> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      200,
    );

    const customer = await this.prisma.customer.findFirst({
      where: { id, shopId },
      select: { id: true, name: true, openingBalance: true },
    });
    if (!customer) {
      throw new NotFoundException(resourceNotFound('Customer', id));
    }

    const [sales, payments, returns] = await Promise.all([
      this.prisma.sale.findMany({
        where: { shopId, customerId: id },
        select: {
          id: true,
          saleNo: true,
          saleDate: true,
          createdAt: true,
          totalAmount: true,
          status: true,
          notes: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { shopId, customerId: id },
        select: {
          id: true,
          saleId: true,
          amount: true,
          paymentDate: true,
          createdAt: true,
          status: true,
          notes: true,
        },
      }),
      this.prisma.saleReturn.findMany({
        where: { shopId, customerId: id },
        select: {
          id: true,
          saleId: true,
          returnDate: true,
          createdAt: true,
          returnAmount: true,
          status: true,
          reason: true,
          refunds: {
            select: {
              id: true,
              amount: true,
              refundDate: true,
              createdAt: true,
              notes: true,
            },
          },
        },
      }),
    ]);

    const saleNoById = new Map(sales.map((s) => [s.id, s.saleNo]));

    type RawEntry = Omit<LedgerEntryDto, 'amount' | 'delta' | 'balance'> & {
      sortAt: number;
      createdAt: number;
      amount: bigint;
      delta: bigint;
    };

    const raws: RawEntry[] = [
      ...sales.map<RawEntry>((s) => ({
        id: s.id,
        type: 'SALE',
        date: s.saleDate.toISOString(),
        reference: s.saleNo,
        notes: s.notes,
        status: s.status,
        sortAt: s.saleDate.getTime(),
        createdAt: s.createdAt.getTime(),
        amount: s.totalAmount,
        delta: s.status === RecordStatus.ACTIVE ? s.totalAmount : 0n,
      })),
      ...payments.map<RawEntry>((p) => ({
        id: p.id,
        type: 'PAYMENT',
        date: p.paymentDate.toISOString(),

        reference: p.saleId ? (saleNoById.get(p.saleId) ?? null) : null,
        notes: p.notes,
        status: p.status,
        sortAt: p.paymentDate.getTime(),
        createdAt: p.createdAt.getTime(),
        amount: p.amount,
        delta: p.status === RecordStatus.ACTIVE ? -p.amount : 0n,
      })),

      ...returns.flatMap<RawEntry>((r) => [
        {
          id: r.id,
          type: 'RETURN',
          date: r.returnDate.toISOString(),
          reference: saleNoById.get(r.saleId) ?? null,
          notes: r.reason,
          status: r.status,
          sortAt: r.returnDate.getTime(),
          createdAt: r.createdAt.getTime(),
          amount: r.returnAmount,
          delta: r.status === RecordStatus.ACTIVE ? -r.returnAmount : 0n,
        },
        ...r.refunds.map<RawEntry>((refund) => ({
          id: refund.id,
          type: 'REFUND',
          date: refund.refundDate.toISOString(),
          reference: saleNoById.get(r.saleId) ?? null,
          notes: refund.notes ?? r.reason,
          status: 'ACTIVE',
          sortAt: refund.refundDate.getTime(),
          createdAt: refund.createdAt.getTime(),
          amount: refund.amount,
          delta: refund.amount,
        })),
      ]),
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
      customer.openingBalance,
      page,
      pageSize,
      {
        customerId: customer.id,
        customerName: customer.name,
      },
    );
  }

  async updateCustomer(
    id: string,
    dto: UpdateCustomerDto,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const data: Prisma.CustomerUpdateManyMutationInput = {};
    if (dto.name !== undefined) {
      if (dto.name === null) {
        throw new BadRequestException(
          requiredFieldCannotBeNull('Customer', 'Name'),
        );
      }
      data.name = dto.name.trim();
    }
    if (dto.phone !== undefined) {
      const phone = dto.phone === null ? null : normalizePhoneOrRaw(dto.phone);
      await this.assertPhoneAvailable(phone, id);
      data.phone = phone;
    }
    if (dto.address !== undefined) {
      data.address = dto.address === null ? null : dto.address.trim();
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes === null ? null : dto.notes.trim();
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.openingBalance !== undefined) {
      data.openingBalance = BigInt(dto.openingBalance);
    }

    const result = await this.prisma.customer.updateMany({
      where: { id, shopId },
      data,
    });
    if (result.count === 0) {
      throw new NotFoundException(resourceNotFound('Customer', id));
    }

    return new StatusBaseResponseDTO(true, 'Customer updated successfully');
  }

  async deleteCustomer(
    id: string,
    shopId: string,

    _userId: string,
  ): Promise<StatusBaseResponseDTO> {
    const result = await this.prisma.customer.updateMany({
      where: { id, shopId },
      data: { isActive: false },
    });
    if (result.count === 0) {
      throw new NotFoundException(resourceNotFound('Customer', id));
    }

    return new StatusBaseResponseDTO(true, 'Customer deactivated successfully');
  }

  private toResponse(customer: Customer, ledgerDelta = 0): ResponseCustomerDto {
    const openingBalance = Number(customer.openingBalance);
    return {
      ...customer,
      openingBalance,
      currentBalance: openingBalance + ledgerDelta,
    };
  }

  private async assertPhoneAvailable(
    phone: string | null,
    excludeCustomerId?: string,
  ): Promise<void> {
    if (!phone) return;
    const conflict = await findLoginPhoneConflict(this.prisma, phone, {
      excludeCustomerId,
    });
    if (conflict) {
      throw new BadRequestException(loginPhoneAlreadyTaken(phone));
    }
  }
}
