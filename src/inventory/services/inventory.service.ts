import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { buildTokenizedSearchAnd } from '../../helpers/tokenized-search.helper.js';
import {
  InventoryMovementType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { InventoryUnitQueryFilterDto } from '../dto/inventory-unit-query.filter.js';
import { CreateInventoryAdjustmentDto } from '../dto/create-inventory-adjustment.dto.js';
import { UpdateInventoryUnitDto } from '../dto/update-inventory-unit.dto.js';
import { InventoryAdjustmentQueryFilterDto } from '../dto/inventory-adjustment-query.filter.js';
import { ResponseInventoryMovementDto } from '../dto/response-inventory-movement.dto.js';
import { ResponseInventoryUnitDto } from '../dto/response-inventory-unit.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  batteryHealthNotAllowed,
  resourceNotFound,
  unitNotEditable,
} from '../../errors/error.builder.js';
import { isAppleBrandName } from '../../helpers/device-family.helper.js';
import type { InventoryAdjustmentOutcome } from './inventory.service.types.js';
import { StorefrontRevalidateService } from '../../store/services/storefront-revalidate.service.js';
import { InventoryAdjustmentService } from './inventory-adjustment.service.js';
import {
  mapMovementToResponse,
  mapUnitToResponse,
  MOVEMENT_INCLUDE,
  UNIT_INCLUDE,
} from '../helpers/inventory.mapper.js';

export type { InventoryAdjustmentOutcome } from './inventory.service.types.js';

const MANUAL_TYPES: InventoryMovementType[] = [
  InventoryMovementType.ADJUSTMENT,
  InventoryMovementType.DAMAGED,
  InventoryMovementType.LOST,
];

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storefrontRevalidate: StorefrontRevalidateService,
    private readonly adjustments: InventoryAdjustmentService,
  ) {}

  async listUnits(
    query: InventoryUnitQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseInventoryUnitDto>> {
    const product = await this.prisma.product.findFirst({
      where: { id: query.productId, shopId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(resourceNotFound('Product', query.productId));
    }

    const where: Prisma.InventoryUnitWhereInput = {
      shopId,
      productId: query.productId,
    };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as UnitStatus;
    } else if (!query.status) {
      where.status = UnitStatus.IN_STOCK;
    }

    const searchAnd = buildTokenizedSearchAnd<Prisma.InventoryUnitWhereInput>(
      query.search,
      (token) => [
        { imei1: { contains: token, mode: 'insensitive' } },
        { imei2: { contains: token, mode: 'insensitive' } },
      ],
    );
    if (searchAnd.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        ...searchAnd,
      ];
    }

    if (query.condition) {
      where.condition = query.condition;
    }

    if (query.batteryMin != null) {
      where.batteryHealth = { gte: query.batteryMin };
    }

    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const skip = getSkipNumber(page, pageSize);

    const [rows, total] = await Promise.all([
      this.prisma.inventoryUnit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: UNIT_INCLUDE,
      }),
      this.prisma.inventoryUnit.count({ where }),
    ]);

    const items = rows.map((row) => mapUnitToResponse(row));

    return new PaginatedResponseDTO(items, total, page, pageSize);
  }

  async listInStockUnits(
    productId: string,
    shopId: string,
  ): Promise<ResponseInventoryUnitDto[]> {
    const page = await this.listUnits(
      { productId, status: UnitStatus.IN_STOCK, page: 1, pageSize: 100 },
      shopId,
    );
    return page.items;
  }

  async createAdjustment(
    dto: CreateInventoryAdjustmentDto,
    shopId: string,
  ): Promise<InventoryAdjustmentOutcome> {
    return this.adjustments.createAdjustment(dto, shopId);
  }

  async updateUnit(
    id: string,
    dto: UpdateInventoryUnitDto,
    shopId: string,
  ): Promise<ResponseInventoryUnitDto> {
    const unit = await this.prisma.inventoryUnit.findFirst({
      where: { id, shopId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            brand: { select: { name: true } },
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException(resourceNotFound('Inventory unit', id));
    }

    if (unit.status === UnitStatus.VOIDED || unit.status === UnitStatus.SOLD) {
      throw new BadRequestException(unitNotEditable(unit.status));
    }

    if (dto.batteryHealth != null) {
      if (!isAppleBrandName(unit.product.brand?.name)) {
        throw new BadRequestException(
          batteryHealthNotAllowed(unit.product.name),
        );
      }
    }

    const data: Prisma.InventoryUnitUpdateInput = {};
    if (dto.askingPrice !== undefined) {
      data.askingPrice =
        dto.askingPrice != null ? BigInt(dto.askingPrice) : null;
    }
    if (dto.defectNotes !== undefined) {
      data.defectNotes = dto.defectNotes?.trim() || null;
    }
    if (dto.batteryHealth !== undefined) {
      data.batteryHealth = dto.batteryHealth;
    }
    if (dto.condition !== undefined) {
      data.condition = dto.condition;
    }

    const updated = await this.prisma.inventoryUnit.update({
      where: { id: unit.id },
      data,
      include: UNIT_INCLUDE,
    });

    this.storefrontRevalidate.invalidateShopById(shopId);

    return mapUnitToResponse(updated);
  }

  async getInventoryMovements(
    query: InventoryAdjustmentQueryFilterDto,
    shopId: string,
  ): Promise<PaginatedResponseDTO<ResponseInventoryMovementDto>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.InventoryMovementWhereInput = { shopId };

    if (query.type) {
      where.type = query.type;
    } else if (query.scope !== 'all') {
      where.type = { in: MANUAL_TYPES };
    }
    if (query.productId) where.productId = query.productId;
    if (query.quantityChange !== undefined) {
      where.quantityChange = query.quantityChange;
    }

    const andFilters: Prisma.InventoryMovementWhereInput[] = [];
    if (query.from)
      andFilters.push({ createdAt: { gte: new Date(query.from) } });
    if (query.to) andFilters.push({ createdAt: { lte: new Date(query.to) } });

    if (query.reason?.trim()) {
      const words = query.reason.trim().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        andFilters.push({
          reason: { contains: words[0], mode: 'insensitive' },
        });
      } else if (words.length > 1) {
        andFilters.push({
          OR: words.map((word) => ({
            reason: { contains: word, mode: 'insensitive' as const },
          })),
        });
      }
    }

    if (andFilters.length > 0) where.AND = andFilters;

    const movementSearchAnd =
      buildTokenizedSearchAnd<Prisma.InventoryMovementWhereInput>(
        query.search,
        (token) => [
          { product: { name: { contains: token, mode: 'insensitive' } } },
          { reason: { contains: token, mode: 'insensitive' } },
        ],
      );
    if (movementSearchAnd.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        ...movementSearchAnd,
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: MOVEMENT_INCLUDE,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return new PaginatedResponseDTO<ResponseInventoryMovementDto>(
      rows.map((row) => mapMovementToResponse(row)),
      total,
      page,
      pageSize,
    );
  }
}
