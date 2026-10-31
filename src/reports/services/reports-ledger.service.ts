import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RecordStatus } from '../../generated/prisma/enums.js';
import { dateColumnRange, shiftDays } from '../../helpers/date.helper.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import { formatBusinessDate } from '../../helpers/csv.helper.js';
import { ReportQueryFilterDto } from '../dto/report-query.filter.js';
import { ReportPageResponseDTO } from '../dto/report-page-response.dto.js';
import {
  SaleReportRowDTO,
  SalesReportSummaryDTO,
} from '../dto/sales-report.dto.js';
import {
  PurchaseReportRowDTO,
  PurchaseReportSummaryDTO,
} from '../dto/purchase-report.dto.js';
import {
  ExpenseReportRowDTO,
  ExpenseReportSummaryDTO,
  ExpenseCategoryBreakdownDTO,
} from '../dto/expense-report.dto.js';
import {
  ProfitReportSummaryDTO,
  ProfitDayRowDTO,
} from '../dto/profit-report.dto.js';
import { ReportsQueryHelper } from './reports-query.helper.js';
import type {
  ReportInstantRange,
  ReportStringRange,
} from './reports.service.types.js';

const ACTIVE = RecordStatus.ACTIVE;

@Injectable()
export class ReportsLedgerService {
  private readonly logger = new Logger(ReportsLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly query: ReportsQueryHelper,
  ) {}

  async getSalesReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<ReportPageResponseDTO<SaleReportRowDTO, SalesReportSummaryDTO>> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const range = this.query.resolveRange(query);
    const where = {
      shopId,
      status: ACTIVE,
      saleDate: { gte: range.start, lt: range.end },
    };
    const search = this.query.searchOr(query, ['saleNo', 'customerName']);

    const [rows, total, summary] = await Promise.all([
      this.prisma.sale.findMany({
        where: { ...where, ...search },
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: this.query.orderBy('saleDate', query, [
          'saleDate',
          'saleNo',
          'totalAmount',
        ]),
        include: {
          customer: { select: { name: true } },
          items: { select: { quantity: true, unitCost: true } },
          payments: { where: { status: ACTIVE }, select: { amount: true } },
          saleReturns: {
            where: { status: ACTIVE },
            select: {
              returnAmount: true,
              refunds: { select: { amount: true } },
            },
          },
        },
      }),
      this.prisma.sale.count({ where: { ...where, ...search } }),
      this.salesSummary(shopId, range),
    ]);

    const items: SaleReportRowDTO[] = rows.map((sale) => {
      const cogs = sale.items.reduce(
        (sum, item) => sum + Number(item.unitCost) * item.quantity,
        0,
      );
      const subtotal = Number(sale.subtotal);
      const paid = sale.payments.reduce((s, p) => s + Number(p.amount), 0);
      const returns = sale.saleReturns.reduce(
        (s, r) => s + Number(r.returnAmount),
        0,
      );
      const refunds = sale.saleReturns.reduce(
        (s, r) => s + r.refunds.reduce((x, f) => x + Number(f.amount), 0),
        0,
      );
      return {
        id: sale.id,
        saleNo: sale.saleNo,
        saleDate: formatBusinessDate(sale.saleDate),
        customerName: sale.customer?.name ?? null,
        subtotal,
        discount: Number(sale.discount),
        totalAmount: Number(sale.totalAmount),
        paid,
        returns,
        refunds,
        outstanding: Number(sale.totalAmount) - returns + refunds - paid,
        profit: subtotal - Number(sale.discount) - cogs,
      };
    });

    return new ReportPageResponseDTO(
      items,
      summary,
      total,
      page,
      pageSize,
      range.from,
      range.to,
    );
  }

  private async salesSummary(
    shopId: string,
    range: ReportInstantRange,
  ): Promise<SalesReportSummaryDTO> {
    const saleWhere = {
      shopId,
      status: ACTIVE,
      saleDate: { gte: range.start, lt: range.end },
    };
    const [agg, saleItems, returns, payments] = await Promise.all([
      this.prisma.sale.aggregate({
        where: saleWhere,
        _count: { _all: true },
        _sum: { subtotal: true, discount: true, totalAmount: true },
      }),
      this.prisma.saleItem.findMany({
        where: { shopId, sale: saleWhere },
        select: { unitCost: true, quantity: true },
      }),
      this.prisma.saleReturn.findMany({
        where: { shopId, status: ACTIVE, sale: saleWhere },
        select: { returnAmount: true },
      }),
      this.prisma.payment.findMany({
        where: { shopId, status: ACTIVE, sale: saleWhere },
        select: { amount: true },
      }),
    ]);

    const cogs = saleItems.reduce(
      (sum, item) => sum + Number(item.unitCost) * item.quantity,
      0,
    );
    const sumSubtotal = Number(agg._sum.subtotal ?? 0n);
    const sumDiscount = Number(agg._sum.discount ?? 0n);
    return {
      count: agg._count._all,
      sumSubtotal,
      sumDiscount,
      sumTotalAmount: Number(agg._sum.totalAmount ?? 0n),
      sumProfit: sumSubtotal - sumDiscount - cogs,
      sumReturns: returns.reduce((s, r) => s + Number(r.returnAmount), 0),
      sumPaid: payments.reduce((s, p) => s + Number(p.amount), 0),
    };
  }

  async getPurchaseReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<PurchaseReportRowDTO, PurchaseReportSummaryDTO>
  > {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const range = this.query.resolveRange(query);
    const dateRange = dateColumnRange(range.from, range.to);
    const where = { shopId, status: ACTIVE, purchaseDate: dateRange };
    const search = this.query.searchOr(query, [
      'purchaseNo',
      'supplierName',
      'invoiceRef',
    ]);

    const [rows, total, summary] = await Promise.all([
      this.prisma.purchase.findMany({
        where: { ...where, ...search },
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: this.query.orderBy('purchaseDate', query, [
          'purchaseDate',
          'purchaseNo',
          'totalAmount',
        ]),
        include: {
          supplier: { select: { name: true } },
          supplierPayments: {
            where: { status: ACTIVE },
            select: { amount: true },
          },
        },
      }),
      this.prisma.purchase.count({ where: { ...where, ...search } }),
      this.purchaseSummary(shopId, range),
    ]);

    const items: PurchaseReportRowDTO[] = rows.map((purchase) => {
      const paid = purchase.supplierPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      return {
        id: purchase.id,
        purchaseNo: purchase.purchaseNo,
        purchaseDate: formatBusinessDate(purchase.purchaseDate),
        supplierName: purchase.supplier.name,
        supplierInvoiceRef: purchase.supplierInvoiceRef,
        isOpeningStock: purchase.isOpeningStock,
        totalAmount: Number(purchase.totalAmount),
        paid,
        outstanding: purchase.isOpeningStock
          ? 0
          : Number(purchase.totalAmount) - paid,
      };
    });

    return new ReportPageResponseDTO(
      items,
      summary,
      total,
      page,
      pageSize,
      range.from,
      range.to,
    );
  }

  private async purchaseSummary(
    shopId: string,
    range: ReportStringRange,
  ): Promise<PurchaseReportSummaryDTO> {
    const dateRange = dateColumnRange(range.from, range.to);
    const where = { shopId, status: ACTIVE, purchaseDate: dateRange };
    const [agg, realAgg, supplierPayments] = await Promise.all([
      this.prisma.purchase.aggregate({
        where,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.purchase.aggregate({
        where: { ...where, isOpeningStock: false },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.supplierPayment.findMany({
        where: { shopId, status: ACTIVE, purchase: where },
        select: { amount: true },
      }),
    ]);

    const sumPaid = supplierPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const sumReal = Number(realAgg._sum.totalAmount ?? 0n);
    return {
      count: agg._count._all,
      countReal: realAgg._count._all,
      countOpeningStock: agg._count._all - realAgg._count._all,
      sumTotalAmount: Number(agg._sum.totalAmount ?? 0n),
      sumPaid,
      sumOutstanding: sumReal - sumPaid,
    };
  }

  async getExpenseReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<ExpenseReportRowDTO, ExpenseReportSummaryDTO>
  > {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const range = this.query.resolveRange(query);
    const dateRange = dateColumnRange(range.from, range.to);
    const where = { shopId, status: ACTIVE, expenseDate: dateRange };
    const search = this.query.searchOr(query, ['description', 'categoryName']);

    const [rows, total, summary] = await Promise.all([
      this.prisma.expense.findMany({
        where: { ...where, ...search },
        skip: getSkipNumber(page, pageSize),
        take: pageSize,
        orderBy: this.query.orderBy('expenseDate', query, [
          'expenseDate',
          'amount',
          'createdAt',
        ]),
        include: { category: { select: { name: true } } },
      }),
      this.prisma.expense.count({ where: { ...where, ...search } }),
      this.expenseSummary(shopId, where),
    ]);

    const items: ExpenseReportRowDTO[] = rows.map((expense) => ({
      id: expense.id,
      expenseDate: formatBusinessDate(expense.expenseDate),
      categoryName: expense.category.name,
      description: expense.description,
      amount: Number(expense.amount),
    }));

    return new ReportPageResponseDTO(
      items,
      summary,
      total,
      page,
      pageSize,
      range.from,
      range.to,
    );
  }

  private async expenseSummary(
    shopId: string,
    where: object,
  ): Promise<ExpenseReportSummaryDTO> {
    const [total, byCategory] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where,
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    const names = await this.prisma.expenseCategory.findMany({
      where: { shopId, id: { in: byCategory.map((r) => r.categoryId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(names.map((n) => [n.id, n.name]));

    const breakdown: ExpenseCategoryBreakdownDTO[] = byCategory
      .map((row) => ({
        categoryName: nameById.get(row.categoryId) ?? row.categoryId,
        count: row._count,
        total: Number(row._sum.amount ?? 0n),
      }))
      .sort((a, b) => b.total - a.total);

    return {
      count: total._count._all,
      total: Number(total._sum.amount ?? 0n),
      byCategory: breakdown,
    };
  }

  async getProfitReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<ReportPageResponseDTO<ProfitDayRowDTO, ProfitReportSummaryDTO>> {
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

    const [sales, saleItems, expenses, returns, returnItems] =
      await Promise.all([
        this.prisma.sale.findMany({
          where: saleWhere,
          select: { saleDate: true, totalAmount: true },
        }),
        this.prisma.saleItem.findMany({
          where: { shopId, sale: saleWhere },
          select: {
            quantity: true,
            unitCost: true,
            sale: { select: { saleDate: true } },
          },
        }),
        this.prisma.expense.findMany({
          where: {
            shopId,
            status: ACTIVE,
            expenseDate: dateColumnRange(range.from, range.to),
          },
          select: { expenseDate: true, amount: true },
        }),
        this.prisma.saleReturn.findMany({
          where: {
            shopId,
            status: ACTIVE,
            returnDate: { gte: range.start, lt: range.end },
          },
          select: { returnDate: true, returnAmount: true },
        }),
        this.prisma.returnItem.findMany({
          where: {
            shopId,
            saleReturn: {
              status: ACTIVE,
              returnDate: { gte: range.start, lt: range.end },
            },
          },
          select: {
            quantity: true,
            saleItem: { select: { unitCost: true } },
            saleReturn: { select: { returnDate: true } },
          },
        }),
      ]);

    const gross = new Map<string, number>();
    const cogs = new Map<string, number>();
    const returnedCogsByDay = new Map<string, number>();
    const expenseByDay = new Map<string, number>();
    const returnByDay = new Map<string, number>();

    for (const sale of sales) {
      const day = formatBusinessDate(sale.saleDate);
      gross.set(day, (gross.get(day) ?? 0) + Number(sale.totalAmount));
    }
    for (const item of saleItems) {
      const day = formatBusinessDate(item.sale.saleDate);
      cogs.set(
        day,
        (cogs.get(day) ?? 0) + Number(item.unitCost) * item.quantity,
      );
    }
    for (const item of returnItems) {
      const day = formatBusinessDate(item.saleReturn.returnDate);
      returnedCogsByDay.set(
        day,
        (returnedCogsByDay.get(day) ?? 0) +
          Number(item.saleItem.unitCost) * item.quantity,
      );
    }
    for (const expense of expenses) {
      const day = formatBusinessDate(expense.expenseDate);
      expenseByDay.set(
        day,
        (expenseByDay.get(day) ?? 0) + Number(expense.amount),
      );
    }
    for (const r of returns) {
      const day = formatBusinessDate(r.returnDate);
      returnByDay.set(
        day,
        (returnByDay.get(day) ?? 0) + Number(r.returnAmount),
      );
    }

    const rows: ProfitDayRowDTO[] = [];
    let day = range.from;
    let tGross = 0;
    let tGrossCogs = 0;
    let tReturnedCogs = 0;
    let tReturns = 0;
    let tExpenses = 0;
    while (day <= range.to) {
      const d = day;
      const g = gross.get(d) ?? 0;
      const grossC = cogs.get(d) ?? 0;
      const retC = returnedCogsByDay.get(d) ?? 0;
      const netC = Math.max(0, grossC - retC);
      const ret = returnByDay.get(d) ?? 0;
      const exp = expenseByDay.get(d) ?? 0;
      tGross += g;
      tGrossCogs += grossC;
      tReturnedCogs += retC;
      tReturns += ret;
      tExpenses += exp;
      rows.push({
        date: d,
        grossSales: g,
        cogs: netC,
        returns: ret,
        expenses: exp,
        profit: g - ret - netC - exp,
      });
      day = shiftDays(day, 1);
    }

    const tNetCogs = Math.max(0, tGrossCogs - tReturnedCogs);
    const netSales = Math.max(0, tGross - tReturns);
    const grossProfit = netSales - tNetCogs;
    const netProfit = grossProfit - tExpenses;

    const startIndex = (page - 1) * pageSize;
    const summary: ProfitReportSummaryDTO = {
      grossSales: tGross,
      cogs: tNetCogs,
      grossProfit,
      returns: tReturns,
      expenses: tExpenses,
      netProfit,
      salesCount: sales.length,
    };

    return new ReportPageResponseDTO(
      rows.slice(startIndex, startIndex + pageSize),
      summary,
      rows.length,
      page,
      pageSize,
      range.from,
      range.to,
    );
  }
}
