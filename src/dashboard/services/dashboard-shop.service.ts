import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CashDirection } from '../../generated/prisma/enums.js';
import {
  buildBuckets,
  resolveDashboardRange,
} from '../helpers/dashboard-date.helper.js';
import { waterfallNetProfit } from '../helpers/dashboard-reconciliation.helper.js';
import { DashboardCacheService } from './dashboard-cache.service.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardFlowService } from './dashboard-flow.service.js';
import { ShopDashboardQueryDto } from '../dto/shop/shop-dashboard-query.dto.js';
import {
  BalanceKpiDto,
  ShopKpisResponseDto,
} from '../dto/shop/shop-kpis.dto.js';
import {
  SalesTrendResponseDto,
  SalesTrendTotalsDto,
} from '../dto/shop/sales-trend.dto.js';
import {
  ProfitWaterfallResponseDto,
  WaterfallStepDto,
  WaterfallTotalsDto,
} from '../dto/shop/profit-waterfall.dto.js';
import {
  CashFlowBucketDto,
  CashFlowResponseDto,
  CashFlowTotalsDto,
} from '../dto/shop/cash-flow.dto.js';

@Injectable()
export class DashboardShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DashboardCacheService,
    private readonly dashboardService: DashboardService,
    private readonly flowService: DashboardFlowService,
  ) {}

  async getKpis(
    shopId: string,
    query: ShopDashboardQueryDto,
  ): Promise<ShopKpisResponseDto> {
    const cacheKey = `shop:${shopId}:kpis:${query.period ?? ''}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = this.cache.get<ShopKpisResponseDto>(cacheKey);
    if (cached) return cached;

    const range = resolveDashboardRange(query.period, query.from, query.to);

    const [currentFlow, prevFlow, balanceRecord, sparklines] =
      await Promise.all([
        this.flowService.calculateFlowTotals(shopId, range.start, range.end),
        this.flowService.calculateFlowTotals(
          shopId,
          range.prevStart,
          range.prevEnd,
        ),
        this.dashboardService.getDashboard({ period: 'today' }, shopId),
        this.flowService.calculateSparklines(shopId, range.to),
      ]);

    const balance: BalanceKpiDto = {
      customerUdhar: balanceRecord.customerUdhar,
      supplierPayable: balanceRecord.supplierPayable,
      cashInHand: balanceRecord.cashPosition,
      lowStockCount: balanceRecord.lowStockProducts,
    };

    const result: ShopKpisResponseDto = {
      range: {
        from: range.from,
        to: range.to,
        prevFrom: range.prevFrom,
        prevTo: range.prevTo,
        granularity: range.granularity,
      },
      totals: currentFlow,
      previousTotals: prevFlow,
      balance,
      sparklines,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getSalesTrend(
    shopId: string,
    query: ShopDashboardQueryDto,
  ): Promise<SalesTrendResponseDto> {
    const cacheKey = `shop:${shopId}:trend:${query.period ?? ''}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = this.cache.get<SalesTrendResponseDto>(cacheKey);
    if (cached) return cached;

    const range = resolveDashboardRange(query.period, query.from, query.to);
    const buckets = buildBuckets(range.from, range.to, range.granularity);
    const prevBuckets = buildBuckets(
      range.prevFrom,
      range.prevTo,
      range.granularity,
    );

    const [series, prevSeries] = await Promise.all([
      this.flowService.buildTrendSeries(shopId, buckets, range.granularity),
      this.flowService.buildTrendSeries(shopId, prevBuckets, range.granularity),
    ]);

    const totals: SalesTrendTotalsDto = series.reduce(
      (acc, b) => {
        acc.sales += b.sales;
        acc.grossProfit += b.grossProfit;
        acc.netProfit += b.netProfit;
        acc.ordersCount += b.ordersCount;
        return acc;
      },
      {
        sales: 0,
        grossProfit: 0,
        netProfit: 0,
        ordersCount: 0,
      },
    );

    const previousTotals: SalesTrendTotalsDto = prevSeries.reduce(
      (acc, b) => {
        acc.sales += b.sales;
        acc.grossProfit += b.grossProfit;
        acc.netProfit += b.netProfit;
        acc.ordersCount += b.ordersCount;
        return acc;
      },
      {
        sales: 0,
        grossProfit: 0,
        netProfit: 0,
        ordersCount: 0,
      },
    );

    const result: SalesTrendResponseDto = {
      range: {
        from: range.from,
        to: range.to,
        prevFrom: range.prevFrom,
        prevTo: range.prevTo,
        granularity: range.granularity,
      },
      series,
      previousSeries: prevSeries,
      totals,
      previousTotals,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getProfitWaterfall(
    shopId: string,
    query: ShopDashboardQueryDto,
  ): Promise<ProfitWaterfallResponseDto> {
    const cacheKey = `shop:${shopId}:waterfall:${query.period ?? ''}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = this.cache.get<ProfitWaterfallResponseDto>(cacheKey);
    if (cached) return cached;

    const range = resolveDashboardRange(query.period, query.from, query.to);
    const flow = await this.flowService.calculateFlowTotals(
      shopId,
      range.start,
      range.end,
    );

    const cogs = Math.max(0, flow.sales - flow.grossProfit);
    const returns = flow.returns ?? 0;

    let running = flow.sales + returns;
    const steps: WaterfallStepDto[] = [
      {
        name: 'Gross Sales',
        amount: flow.sales + returns,
        isNegative: false,
        runningTotal: running,
      },
    ];

    if (returns > 0) {
      running -= returns;
      steps.push({
        name: 'Returns & Refunds',
        amount: returns,
        isNegative: true,
        runningTotal: running,
      });
    }

    running -= cogs;
    steps.push({
      name: 'Cost of Goods (COGS)',
      amount: cogs,
      isNegative: true,
      runningTotal: running,
    });

    running -= flow.expenses;
    steps.push({
      name: 'Operating Expenses',
      amount: flow.expenses,
      isNegative: true,
      runningTotal: running,
    });

    const netProfit = waterfallNetProfit({
      grossSales: flow.sales + returns,
      costOfGoods: cogs,
      returns,
      expenses: flow.expenses,
    });

    steps.push({
      name: 'Net Profit',
      amount: netProfit,
      isNegative: netProfit < 0,
      runningTotal: netProfit,
    });

    const totals: WaterfallTotalsDto = {
      grossSales: flow.sales + returns,
      costOfGoods: cogs,
      returns,
      expenses: flow.expenses,
      netProfit,
    };

    const result: ProfitWaterfallResponseDto = {
      range: {
        from: range.from,
        to: range.to,
        prevFrom: range.prevFrom,
        prevTo: range.prevTo,
        granularity: range.granularity,
      },
      steps,
      totals,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getCashFlow(
    shopId: string,
    query: ShopDashboardQueryDto,
  ): Promise<CashFlowResponseDto> {
    const cacheKey = `shop:${shopId}:cash-flow:${query.period ?? ''}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = this.cache.get<CashFlowResponseDto>(cacheKey);
    if (cached) return cached;

    const range = resolveDashboardRange(query.period, query.from, query.to);
    const buckets = buildBuckets(range.from, range.to, range.granularity);

    const [priorMovements, currentMovements] = await Promise.all([
      this.prisma.cashMovement.groupBy({
        by: ['direction'],
        where: {
          shopId,
          movementDate: { lt: range.start },
        },
        _sum: { amount: true },
      }),
      this.prisma.cashMovement.findMany({
        where: {
          shopId,
          movementDate: { gte: range.start, lte: range.end },
        },
        select: {
          movementDate: true,
          direction: true,
          amount: true,
        },
      }),
    ]);

    let priorIn = 0;
    let priorOut = 0;
    for (const row of priorMovements) {
      const amt = Number(row._sum.amount ?? 0n);
      if (row.direction === CashDirection.IN) priorIn += amt;
      else priorOut += amt;
    }
    const openingBalance = priorIn - priorOut;

    const bucketMap = new Map<string, { cashIn: number; cashOut: number }>();
    for (const b of buckets) {
      bucketMap.set(b, { cashIn: 0, cashOut: 0 });
    }

    let totalCashIn = 0;
    let totalCashOut = 0;

    for (const m of currentMovements) {
      const amt = Number(m.amount);
      const dateStr = m.movementDate.toISOString().slice(0, 10);
      const bKey = this.flowService.findMatchingBucket(dateStr, buckets);
      const entry = bucketMap.get(bKey);

      if (m.direction === CashDirection.IN) {
        totalCashIn += amt;
        if (entry) entry.cashIn += amt;
      } else {
        totalCashOut += amt;
        if (entry) entry.cashOut += amt;
      }
    }

    const netCashChange = totalCashIn - totalCashOut;
    const closingBalance = openingBalance + netCashChange;

    let runningClosing = openingBalance;
    const series: CashFlowBucketDto[] = buckets.map((b) => {
      const entry = bucketMap.get(b) ?? { cashIn: 0, cashOut: 0 };
      const net = entry.cashIn - entry.cashOut;
      runningClosing += net;
      return {
        date: b,
        cashIn: entry.cashIn,
        cashOut: entry.cashOut,
        netChange: net,
        closingBalance: runningClosing,
      };
    });

    const totals: CashFlowTotalsDto = {
      cashIn: totalCashIn,
      cashOut: totalCashOut,
      netChange: netCashChange,
    };

    const result: CashFlowResponseDto = {
      range: {
        from: range.from,
        to: range.to,
        prevFrom: range.prevFrom,
        prevTo: range.prevTo,
        granularity: range.granularity,
      },
      openingBalance,
      closingBalance,
      series,
      totals,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }
}
