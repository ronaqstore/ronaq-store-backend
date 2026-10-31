import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RecordStatus } from '../../generated/prisma/enums.js';
import {
  businessToday,
  dateColumnRange,
  shiftDays,
} from '../../helpers/date.helper.js';
import { resolveDashboardRange } from '../helpers/dashboard-date.helper.js';
import { FlowKpiTotalsDto, SparklinesDto } from '../dto/shop/shop-kpis.dto.js';
import { SalesTrendBucketDto } from '../dto/shop/sales-trend.dto.js';

const ACTIVE = RecordStatus.ACTIVE;

interface FlowRecordsBundle {
  sales: Array<{ saleDate: Date; totalAmount: bigint }>;
  saleItems: Array<{
    quantity: number;
    unitCost: bigint;
    sale: { saleDate: Date };
  }>;
  expenses: Array<{ expenseDate: Date; amount: bigint }>;
  returns: Array<{ returnDate: Date; returnAmount: bigint }>;
  returnItems: Array<{
    quantity: number;
    saleItem: { unitCost: bigint };
    saleReturn: { returnDate: Date };
  }>;
}

@Injectable()
export class DashboardFlowService {
  constructor(private readonly prisma: PrismaService) {}

  private async fetchFlowRecordsBundle(
    shopId: string,
    start: Date,
    end: Date,
    fromDateStr: string,
    toDateStr: string,
  ): Promise<FlowRecordsBundle> {
    const [sales, saleItems, returns, expenses, returnItems] =
      await Promise.all([
        this.prisma.sale.findMany({
          where: {
            shopId,
            status: ACTIVE,
            saleDate: { gte: start, lte: end },
          },
          select: { saleDate: true, totalAmount: true },
        }),
        this.prisma.saleItem.findMany({
          where: {
            shopId,
            sale: { status: ACTIVE, saleDate: { gte: start, lte: end } },
          },
          select: {
            quantity: true,
            unitCost: true,
            sale: { select: { saleDate: true } },
          },
        }),
        this.prisma.saleReturn.findMany({
          where: {
            shopId,
            status: ACTIVE,
            returnDate: { gte: start, lte: end },
          },
          select: { returnDate: true, returnAmount: true },
        }),
        this.prisma.expense.findMany({
          where: {
            shopId,
            status: ACTIVE,
            expenseDate: dateColumnRange(fromDateStr, toDateStr),
          },
          select: { expenseDate: true, amount: true },
        }),
        this.prisma.returnItem.findMany({
          where: {
            shopId,
            saleReturn: {
              status: ACTIVE,
              returnDate: { gte: start, lte: end },
            },
          },
          select: {
            quantity: true,
            saleItem: { select: { unitCost: true } },
            saleReturn: { select: { returnDate: true } },
          },
        }),
      ]);

    return { sales, saleItems, returns, expenses, returnItems };
  }

  async calculateFlowTotals(
    shopId: string,
    start: Date,
    end: Date,
  ): Promise<FlowKpiTotalsDto> {
    const fromStr = businessToday(start);
    const toStr = businessToday(new Date(end.getTime() - 1));

    const [salesAgg, saleItems, returnsAgg, returnItems, expenseAgg] =
      await Promise.all([
        this.prisma.sale.aggregate({
          where: {
            shopId,
            status: ACTIVE,
            saleDate: { gte: start, lte: end },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.saleItem.findMany({
          where: {
            shopId,
            sale: { status: ACTIVE, saleDate: { gte: start, lte: end } },
          },
          select: { unitCost: true, quantity: true },
        }),
        this.prisma.saleReturn.aggregate({
          where: {
            shopId,
            status: ACTIVE,
            returnDate: { gte: start, lte: end },
          },
          _sum: { returnAmount: true },
        }),
        this.prisma.returnItem.findMany({
          where: {
            shopId,
            saleReturn: {
              status: ACTIVE,
              returnDate: { gte: start, lte: end },
            },
          },
          select: {
            quantity: true,
            saleItem: { select: { unitCost: true } },
          },
        }),
        this.prisma.expense.aggregate({
          where: {
            shopId,
            status: ACTIVE,
            expenseDate: dateColumnRange(fromStr, toStr),
          },
          _sum: { amount: true },
        }),
      ]);

    const grossSales = Number(salesAgg._sum.totalAmount ?? 0n);
    const returns = Number(returnsAgg._sum.returnAmount ?? 0n);
    const sales = Math.max(0, grossSales - returns);

    const grossCogs = saleItems.reduce(
      (sum, item) => sum + Number(item.unitCost) * item.quantity,
      0,
    );
    const returnedCogs = returnItems.reduce(
      (sum, item) => sum + Number(item.saleItem.unitCost) * item.quantity,
      0,
    );
    const cogs = Math.max(0, grossCogs - returnedCogs);

    const grossProfit = sales - cogs;
    const expenses = Number(expenseAgg._sum.amount ?? 0n);
    const netProfit = grossProfit - expenses;

    return { sales, grossProfit, netProfit, expenses, returns };
  }

  async calculateSparklines(
    shopId: string,
    toDate: string,
  ): Promise<SparklinesDto> {
    const days: string[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      days.push(shiftDays(toDate, -i));
    }

    const { start } = resolveDashboardRange(undefined, days[0], days[0]);
    const { end } = resolveDashboardRange(
      undefined,
      days[days.length - 1],
      days[days.length - 1],
    );

    const bundle = await this.fetchFlowRecordsBundle(
      shopId,
      start,
      end,
      days[0],
      days[days.length - 1],
    );

    const salesByDay = new Map<string, number>();
    const cogsByDay = new Map<string, number>();
    const returnedCogsByDay = new Map<string, number>();
    const expByDay = new Map<string, number>();
    const retByDay = new Map<string, number>();

    for (const s of bundle.sales) {
      const d = businessToday(s.saleDate);
      salesByDay.set(d, (salesByDay.get(d) ?? 0) + Number(s.totalAmount));
    }
    for (const item of bundle.saleItems) {
      const d = businessToday(item.sale.saleDate);
      cogsByDay.set(
        d,
        (cogsByDay.get(d) ?? 0) + Number(item.unitCost) * item.quantity,
      );
    }
    for (const item of bundle.returnItems) {
      const d = businessToday(item.saleReturn.returnDate);
      returnedCogsByDay.set(
        d,
        (returnedCogsByDay.get(d) ?? 0) +
          Number(item.saleItem.unitCost) * item.quantity,
      );
    }
    for (const r of bundle.returns) {
      const d = businessToday(r.returnDate);
      retByDay.set(d, (retByDay.get(d) ?? 0) + Number(r.returnAmount));
    }
    for (const e of bundle.expenses) {
      const d = businessToday(e.expenseDate);
      expByDay.set(d, (expByDay.get(d) ?? 0) + Number(e.amount));
    }

    const salesPoints: number[] = [];
    const grossProfitPoints: number[] = [];
    const netProfitPoints: number[] = [];
    const expensePoints: number[] = [];

    for (const d of days) {
      const s = Math.max(0, (salesByDay.get(d) ?? 0) - (retByDay.get(d) ?? 0));
      const grossC = cogsByDay.get(d) ?? 0;
      const retC = returnedCogsByDay.get(d) ?? 0;
      const c = Math.max(0, grossC - retC);
      const gp = s - c;
      const exp = expByDay.get(d) ?? 0;
      const np = gp - exp;

      salesPoints.push(s);
      grossProfitPoints.push(gp);
      netProfitPoints.push(np);
      expensePoints.push(exp);
    }

    return {
      sales: salesPoints,
      grossProfit: grossProfitPoints,
      netProfit: netProfitPoints,
      expenses: expensePoints,
    };
  }

  async buildTrendSeries(
    shopId: string,
    buckets: string[],
    granularity: string,
  ): Promise<SalesTrendBucketDto[]> {
    if (buckets.length === 0) return [];
    const fromDate = buckets[0];
    const toDate =
      granularity === 'day'
        ? buckets[buckets.length - 1]
        : shiftDays(buckets[buckets.length - 1], 31);
    const { start } = resolveDashboardRange(undefined, fromDate, fromDate);
    const { end } = resolveDashboardRange(undefined, toDate, toDate);

    const bundle = await this.fetchFlowRecordsBundle(
      shopId,
      start,
      end,
      fromDate,
      toDate,
    );

    const bucketData = new Map<
      string,
      {
        sales: number;
        cogs: number;
        returnedCogs: number;
        returns: number;
        expenses: number;
        ordersCount: number;
      }
    >();
    for (const b of buckets) {
      bucketData.set(b, {
        sales: 0,
        cogs: 0,
        returnedCogs: 0,
        returns: 0,
        expenses: 0,
        ordersCount: 0,
      });
    }

    for (const s of bundle.sales) {
      const dateStr = businessToday(s.saleDate);
      const b = this.findMatchingBucket(dateStr, buckets);
      const entry = bucketData.get(b);
      if (entry) {
        entry.sales += Number(s.totalAmount);
        entry.ordersCount += 1;
      }
    }

    for (const item of bundle.saleItems) {
      const dateStr = businessToday(item.sale.saleDate);
      const b = this.findMatchingBucket(dateStr, buckets);
      const entry = bucketData.get(b);
      if (entry) {
        entry.cogs += Number(item.unitCost) * item.quantity;
      }
    }

    for (const item of bundle.returnItems) {
      const dateStr = businessToday(item.saleReturn.returnDate);
      const b = this.findMatchingBucket(dateStr, buckets);
      const entry = bucketData.get(b);
      if (entry) {
        entry.returnedCogs += Number(item.saleItem.unitCost) * item.quantity;
      }
    }

    for (const r of bundle.returns) {
      const dateStr = businessToday(r.returnDate);
      const b = this.findMatchingBucket(dateStr, buckets);
      const entry = bucketData.get(b);
      if (entry) {
        entry.returns += Number(r.returnAmount);
      }
    }

    for (const e of bundle.expenses) {
      const dateStr = businessToday(e.expenseDate);
      const b = this.findMatchingBucket(dateStr, buckets);
      const entry = bucketData.get(b);
      if (entry) {
        entry.expenses += Number(e.amount);
      }
    }

    return buckets.map((b) => {
      const entry = bucketData.get(b) ?? {
        sales: 0,
        cogs: 0,
        returnedCogs: 0,
        returns: 0,
        expenses: 0,
        ordersCount: 0,
      };
      const netSales = Math.max(0, entry.sales - entry.returns);
      const netCogs = Math.max(0, entry.cogs - entry.returnedCogs);
      const grossProfit = netSales - netCogs;
      const netProfit = grossProfit - entry.expenses;
      return {
        date: b,
        sales: netSales,
        grossProfit,
        netProfit,
        ordersCount: entry.ordersCount,
      };
    });
  }

  findMatchingBucket(dateStr: string, buckets: string[]): string {
    let match = buckets[0];
    for (const b of buckets) {
      if (dateStr >= b) match = b;
      else break;
    }
    return match;
  }
}
