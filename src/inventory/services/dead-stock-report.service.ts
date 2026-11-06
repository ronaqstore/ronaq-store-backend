import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UnitStatus } from '../../generated/prisma/enums.js';
import { businessToday } from '../../helpers/date.helper.js';
import { daysBetween } from '../../dashboard/helpers/dashboard-date.helper.js';
import { DeadStockQueryFilterDto } from '../dto/dead-stock-query.filter.js';
import {
  DeadStockBucketItemDto,
  DeadStockItemsPaginationDto,
  DeadStockSummaryDto,
  DeadStockUnitItemDto,
  ResponseDeadStockReportDto,
} from '../dto/dead-stock-report.dto.js';

const IN_STOCK_DEAD_REPORT_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      model: true,
      color: true,
      storage: true,
      ram: true,
      sku: true,
      ptaStatus: true,
      defaultSellingPrice: true,
      brand: {
        select: {
          id: true,
          name: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  purchaseItem: {
    select: {
      purchase: {
        select: {
          id: true,
          purchaseNo: true,
          purchaseDate: true,
          supplier: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
  consignment: {
    select: {
      id: true,
      consignmentNo: true,
      intakeDate: true,
      consignorName: true,
    },
  },
} as const;

@Injectable()
export class DeadStockReportService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveBucket(days: number): '0-15' | '16-30' | '31-60' | '60+' {
    if (days <= 15) return '0-15';
    if (days <= 30) return '16-30';
    if (days <= 60) return '31-60';
    return '60+';
  }

  async getDeadStockReport(
    query: DeadStockQueryFilterDto,
    shopId: string,
  ): Promise<ResponseDeadStockReportDto> {
    const rawUnits = await this.prisma.inventoryUnit.findMany({
      where: {
        shopId,
        status: UnitStatus.IN_STOCK,
      },
      include: IN_STOCK_DEAD_REPORT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    const today = businessToday();

    let totalStockValue = 0;
    let deadStockCount = 0;
    let deadStockCostValue = 0;
    let cumulativeDays = 0;

    const bucketCounts: Record<'0-15' | '16-30' | '31-60' | '60+', number> = {
      '0-15': 0,
      '16-30': 0,
      '31-60': 0,
      '60+': 0,
    };

    const bucketValues: Record<'0-15' | '16-30' | '31-60' | '60+', number> = {
      '0-15': 0,
      '16-30': 0,
      '31-60': 0,
      '60+': 0,
    };

    const mappedUnits: DeadStockUnitItemDto[] = rawUnits.map((u) => {
      const purchase = u.purchaseItem?.purchase;
      const consignment = u.consignment;

      let intakeDateStr = u.createdAt.toISOString().slice(0, 10);
      let sourceType: 'PURCHASE' | 'CONSIGNMENT' = 'PURCHASE';
      let sourceName: string | null = null;
      let referenceNo: string | null = null;

      if (purchase) {
        sourceType = 'PURCHASE';
        sourceName = purchase.supplier?.name ?? null;
        referenceNo = purchase.purchaseNo ?? null;
        if (purchase.purchaseDate) {
          intakeDateStr = purchase.purchaseDate.toISOString().slice(0, 10);
        }
      } else if (consignment) {
        sourceType = 'CONSIGNMENT';
        sourceName = consignment.consignorName ?? null;
        referenceNo = consignment.consignmentNo ?? null;
        if (consignment.intakeDate) {
          intakeDateStr = consignment.intakeDate.toISOString().slice(0, 10);
        }
      }

      const daysOnShelf = Math.max(0, daysBetween(intakeDateStr, today));
      const agingBucket = this.resolveBucket(daysOnShelf);
      const unitCost = Number(u.unitCost);
      const askingPrice = u.askingPrice != null ? Number(u.askingPrice) : null;
      const defaultPrice = Number(u.product.defaultSellingPrice);
      const effectivePrice = askingPrice ?? defaultPrice;

      totalStockValue += unitCost;
      cumulativeDays += daysOnShelf;
      bucketCounts[agingBucket] += 1;
      bucketValues[agingBucket] += unitCost;

      if (agingBucket === '60+') {
        deadStockCount += 1;
        deadStockCostValue += unitCost;
      }

      return {
        id: u.id,
        productId: u.productId,
        productName: u.product.name,
        brandName: u.product.brand?.name ?? null,
        categoryName: u.product.category?.name ?? null,
        model: u.product.model ?? null,
        color: u.product.color ?? null,
        storage: u.product.storage ?? null,
        ram: u.product.ram ?? null,
        ptaStatus: u.product.ptaStatus ?? null,
        sku: u.product.sku ?? null,
        imei1: u.imei1,
        imei2: u.imei2 ?? null,
        condition: u.condition,
        batteryHealth: u.batteryHealth ?? null,
        defectNotes: u.defectNotes ?? null,
        unitCost,
        askingPrice,
        effectivePrice,
        intakeDate: intakeDateStr,
        daysOnShelf,
        agingBucket,
        sourceType,
        sourceName,
        referenceNo,
      };
    });

    const totalInStockUnits = mappedUnits.length;
    const averageDaysOnShelf =
      totalInStockUnits > 0
        ? Math.round(cumulativeDays / totalInStockUnits)
        : 0;

    const buckets: DeadStockBucketItemDto[] = [
      {
        bucket: '0-15',
        label: '0–15 days',
        count: bucketCounts['0-15'],
        costValue: bucketValues['0-15'],
      },
      {
        bucket: '16-30',
        label: '16–30 days',
        count: bucketCounts['16-30'],
        costValue: bucketValues['16-30'],
      },
      {
        bucket: '31-60',
        label: '31–60 days',
        count: bucketCounts['31-60'],
        costValue: bucketValues['31-60'],
      },
      {
        bucket: '60+',
        label: '60+ days (Dead Stock)',
        count: bucketCounts['60+'],
        costValue: bucketValues['60+'],
      },
    ];

    const summary: DeadStockSummaryDto = {
      totalInStockUnits,
      totalStockValue,
      deadStockCount,
      deadStockCostValue,
      averageDaysOnShelf,
      buckets,
    };

    let filtered = mappedUnits;

    if (query.bucket && query.bucket !== 'ALL') {
      filtered = filtered.filter((item) => item.agingBucket === query.bucket);
    }

    if (query.condition && query.condition !== 'ALL') {
      filtered = filtered.filter((item) => item.condition === query.condition);
    }

    if (query.brandId) {
      filtered = filtered.filter((item) => {
        const matchingRaw = rawUnits.find((r) => r.id === item.id);
        return matchingRaw?.product.brand?.id === query.brandId;
      });
    }

    if (query.search?.trim()) {
      const term = query.search.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.productName.toLowerCase().includes(term) ||
          item.model?.toLowerCase().includes(term) ||
          item.sku?.toLowerCase().includes(term) ||
          item.imei1.includes(term) ||
          item.imei2?.includes(term) ||
          item.sourceName?.toLowerCase().includes(term),
      );
    }

    const sortBy = query.sortBy ?? 'ageDesc';
    filtered.sort((a, b) => {
      if (sortBy === 'ageAsc') {
        return a.daysOnShelf - b.daysOnShelf;
      }
      if (sortBy === 'costDesc') {
        return b.unitCost - a.unitCost;
      }
      if (sortBy === 'costAsc') {
        return a.unitCost - b.unitCost;
      }
      return b.daysOnShelf - a.daysOnShelf;
    });

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startIndex = (page - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    const pagination: DeadStockItemsPaginationDto = {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };

    return {
      summary,
      pagination,
    };
  }
}
