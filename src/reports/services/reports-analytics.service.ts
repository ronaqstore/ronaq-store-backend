import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  RecordStatus,
  TrackingType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { businessToday } from '../../helpers/date.helper.js';
import { formatBusinessDate } from '../../helpers/csv.helper.js';
import { normalizePagination } from '../../helpers/paginate-helper.js';
import { ReportQueryFilterDto } from '../dto/report-query.filter.js';
import { ReportPageResponseDTO } from '../dto/report-page-response.dto.js';
import {
  CustomerReportRowDTO,
  CustomerReportSummaryDTO,
} from '../dto/customer-report.dto.js';
import {
  SupplierReportRowDTO,
  SupplierReportSummaryDTO,
} from '../dto/supplier-report.dto.js';
import {
  InventoryReportRowDTO,
  InventoryReportSummaryDTO,
} from '../dto/inventory-report.dto.js';
import {
  BestSellerReportRowDTO,
  BestSellerReportSummaryDTO,
} from '../dto/best-seller-report.dto.js';
import { ReportsQueryHelper } from './reports-query.helper.js';

const ACTIVE = RecordStatus.ACTIVE;

@Injectable()
export class ReportsAnalyticsService {
  private readonly logger = new Logger(ReportsAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly query: ReportsQueryHelper,
  ) {}

  async getCustomerReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<CustomerReportRowDTO, CustomerReportSummaryDTO>
  > {
    const customers = await this.prisma.customer.findMany({
      where: {
        shopId,
        isActive: true,
        ...this.query.searchOr(query, ['name', 'phone']),
      },
      include: {
        sales: {
          where: { status: ACTIVE },
          select: {
            totalAmount: true,
            saleDate: true,
            dueDate: true,
            payments: {
              where: { status: ACTIVE },
              select: { amount: true },
            },
            saleReturns: {
              where: { status: ACTIVE },
              select: {
                returnAmount: true,
                refunds: { select: { amount: true } },
              },
            },
          },
        },
      },
    });

    const today = new Date(`${businessToday()}T00:00:00.000Z`);
    const rows: CustomerReportRowDTO[] = customers.map((customer) => {
      let bought = 0;
      let paid = 0;
      let returns = 0;
      let refunds = 0;
      let overdue = 0;
      let lastSaleDate: string | null = null;
      for (const sale of customer.sales) {
        const salePaid = sale.payments.reduce(
          (s, p) => s + Number(p.amount),
          0,
        );
        const saleReturns = sale.saleReturns.reduce(
          (s, r) => s + Number(r.returnAmount),
          0,
        );
        const saleRefunds = sale.saleReturns.reduce(
          (s, r) => s + r.refunds.reduce((x, f) => x + Number(f.amount), 0),
          0,
        );
        bought += Number(sale.totalAmount);
        paid += salePaid;
        returns += saleReturns;
        refunds += saleRefunds;
        const date = formatBusinessDate(sale.saleDate);
        if (!lastSaleDate || date > lastSaleDate) lastSaleDate = date;
        if (sale.dueDate && sale.dueDate < today) {
          const remaining = Number(sale.totalAmount) - salePaid - saleReturns;
          if (remaining > 0) overdue += remaining;
        }
      }
      const opening = Number(customer.openingBalance);
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        openingBalance: opening,
        bought,
        paid,
        returns,
        refunds,
        outstanding: opening + bought - paid - returns + refunds,
        overdue,
        lastSaleDate,
      };
    });

    return this.query.pageSnapshot(
      rows,
      query,
      'outstanding',
      ['name', 'outstanding', 'lastSaleDate'],
      {
        count: rows.length,
        totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0),
        totalOverdue: rows.reduce((s, r) => s + r.overdue, 0),
      },
    );
  }

  async getSupplierReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<SupplierReportRowDTO, SupplierReportSummaryDTO>
  > {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        shopId,
        isActive: true,
        ...this.query.searchOr(query, ['name', 'phone']),
      },
      include: {
        purchases: {
          where: { status: ACTIVE, isOpeningStock: false },
          select: { totalAmount: true, purchaseDate: true },
        },
        supplierPayments: {
          where: { status: ACTIVE },
          select: { amount: true },
        },
      },
    });

    const rows: SupplierReportRowDTO[] = suppliers.map((supplier) => {
      let bought = 0;
      let lastPurchaseDate: string | null = null;
      for (const purchase of supplier.purchases) {
        bought += Number(purchase.totalAmount);
        const date = purchase.purchaseDate.toISOString().slice(0, 10);
        if (!lastPurchaseDate || date > lastPurchaseDate) {
          lastPurchaseDate = date;
        }
      }
      const paid = supplier.supplierPayments.reduce(
        (s, p) => s + Number(p.amount),
        0,
      );
      const opening = Number(supplier.openingBalance);
      return {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        openingBalance: opening,
        bought,
        paid,
        payable: opening + bought - paid,
        lastPurchaseDate,
      };
    });

    return this.query.pageSnapshot(
      rows,
      query,
      'payable',
      ['name', 'payable', 'lastPurchaseDate'],
      {
        count: rows.length,
        totalPayable: rows.reduce((s, r) => s + r.payable, 0),
      },
    );
  }

  async getInventoryReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<InventoryReportRowDTO, InventoryReportSummaryDTO>
  > {
    const products = await this.prisma.product.findMany({
      where: {
        shopId,
        isActive: true,
        ...this.query.searchOr(query, ['name', 'sku', 'barcode']),
      },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        stockLevel: { select: { quantityOnHand: true, avgUnitCost: true } },
        inventoryUnits: {
          where: { status: UnitStatus.IN_STOCK },
          select: { imei1: true, unitCost: true },
        },
      },
    });

    let rows: InventoryReportRowDTO[] = products.map((product) => {
      const serialized = product.trackingType === TrackingType.SERIALIZED;
      const inStock = serialized
        ? product.inventoryUnits.length
        : (product.stockLevel?.quantityOnHand ?? 0);
      const stockValue = serialized
        ? product.inventoryUnits.reduce((s, u) => s + Number(u.unitCost), 0)
        : inStock * Number(product.stockLevel?.avgUnitCost ?? 0n);
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        categoryName: product.category.name,
        brandName: product.brand.name,
        trackingType: product.trackingType,
        inStock,
        stockValue,
        lowStock: inStock <= product.lowStockThreshold,
        imeis: serialized ? product.inventoryUnits.map((u) => u.imei1) : [],
      };
    });

    if (query.trackingType?.trim()) {
      const types = query.trackingType
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (types.length > 0) {
        rows = rows.filter((row) => types.includes(row.trackingType));
      }
    }
    if (typeof query.lowStock === 'boolean') {
      rows = rows.filter((row) => row.lowStock === query.lowStock);
    }
    if (query.minStockValue !== undefined) {
      const minStockValue = query.minStockValue;
      rows = rows.filter((row) => row.stockValue >= minStockValue);
    }
    if (query.maxStockValue !== undefined) {
      const maxStockValue = query.maxStockValue;
      rows = rows.filter((row) => row.stockValue <= maxStockValue);
    }
    if (query.inStock !== undefined) {
      const inStock = query.inStock;
      rows = rows.filter((row) => row.inStock === inStock);
    }

    return this.query.pageSnapshot(
      rows,
      query,
      'name',
      ['name', 'inStock', 'stockValue', 'trackingType', 'lowStock'],
      {
        countProducts: rows.length,
        countLowStock: rows.filter((r) => r.lowStock).length,
        countUnitsInStock: rows.reduce((s, r) => s + r.inStock, 0),
        stockValueTotal: rows.reduce((s, r) => s + r.stockValue, 0),
      },
    );
  }

  async getBestSellersReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<BestSellerReportRowDTO, BestSellerReportSummaryDTO>
  > {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const range = this.query.resolveRange(query);
    const saleWhere = {
      shopId,
      status: ACTIVE,
      saleDate: { gte: range.start, lt: range.end },
    };
    const search = this.query.searchOr(query, ['productName']);

    const grouped = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: { shopId, sale: saleWhere, ...search },
      _sum: { quantity: true, total: true },
    });

    const names = await this.prisma.product.findMany({
      where: { shopId, id: { in: grouped.map((g) => g.productId) } },
      select: {
        id: true,
        name: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
      },
    });
    const byId = new Map(names.map((p) => [p.id, p]));

    const all: BestSellerReportRowDTO[] = grouped
      .map((g) => {
        const product = byId.get(g.productId);
        return {
          productId: g.productId,
          productName: product?.name ?? g.productId,
          categoryName: product?.category.name ?? '—',
          brandName: product?.brand.name ?? '—',
          quantitySold: Number(g._sum.quantity ?? 0n),
          revenue: Number(g._sum.total ?? 0n),
        };
      })
      .sort((a, b) => b.quantitySold - a.quantitySold);

    const startIndex = (page - 1) * pageSize;
    const summary: BestSellerReportSummaryDTO = {
      countProducts: all.length,
      totalQuantitySold: all.reduce((s, r) => s + r.quantitySold, 0),
      totalRevenue: all.reduce((s, r) => s + r.revenue, 0),
    };

    return new ReportPageResponseDTO(
      all.slice(startIndex, startIndex + pageSize),
      summary,
      all.length,
      page,
      pageSize,
      range.from,
      range.to,
    );
  }
}
