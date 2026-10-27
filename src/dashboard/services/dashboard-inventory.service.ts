import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RecordStatus } from '../../generated/prisma/enums.js';
import {
  daysBetween,
  resolveDashboardRange,
} from '../helpers/dashboard-date.helper.js';
import { DashboardCacheService } from './dashboard-cache.service.js';
import { DashboardReceivablesService } from './dashboard-receivables.service.js';
import { ShopDashboardQueryDto } from '../dto/shop/shop-dashboard-query.dto.js';
import {
  ExpenseCategoryItemDto,
  ExpensesByCategoryResponseDto,
} from '../dto/shop/expenses-by-category.dto.js';
import {
  ConditionSplitDto,
  InventoryAgingBucketDto,
  InventoryAgingResponseDto,
} from '../dto/shop/inventory-aging.dto.js';
import {
  AttentionLowStockProductDto,
  AttentionReconciliationDto,
  AttentionResponseDto,
} from '../dto/shop/attention.dto.js';
import { businessToday } from '../../helpers/date.helper.js';

const ACTIVE = RecordStatus.ACTIVE;
const EXPENSE_TOP_N = 6;
const LOW_STOCK_LIMIT = 5;

@Injectable()
export class DashboardInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DashboardCacheService,
    private readonly receivablesService: DashboardReceivablesService,
  ) {}

  async getExpensesByCategory(
    shopId: string,
    query: ShopDashboardQueryDto,
  ): Promise<ExpensesByCategoryResponseDto> {
    const cacheKey = `shop:${shopId}:expenses-cat:${query.period ?? ''}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = this.cache.get<ExpensesByCategoryResponseDto>(cacheKey);
    if (cached) return cached;

    const range = resolveDashboardRange(query.period, query.from, query.to);

    const [currentRows, prevRows] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: {
          shopId,
          status: ACTIVE,
          expenseDate: {
            gte: new Date(`${range.from}T00:00:00.000Z`),
            lte: new Date(`${range.to}T00:00:00.000Z`),
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where: {
          shopId,
          status: ACTIVE,
          expenseDate: {
            gte: new Date(`${range.prevFrom}T00:00:00.000Z`),
            lte: new Date(`${range.prevTo}T00:00:00.000Z`),
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const catIds = Array.from(
      new Set([
        ...currentRows.map((r) => r.categoryId),
        ...prevRows.map((r) => r.categoryId),
      ]),
    );

    const categories = await this.prisma.expenseCategory.findMany({
      where: { shopId, id: { in: catIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map<string, string>(
      categories.map((c) => [c.id, c.name]),
    );

    const prevMap = new Map<string, number>();
    let prevTotal = 0;
    for (const p of prevRows) {
      const amt = Number(p._sum.amount ?? 0n);
      prevMap.set(p.categoryId, amt);
      prevTotal += amt;
    }

    let curTotal = 0;
    const list: Array<{
      id: string;
      name: string;
      amount: number;
      prev: number;
    }> = [];
    for (const r of currentRows) {
      const amt = Number(r._sum.amount ?? 0n);
      curTotal += amt;
      list.push({
        id: r.categoryId,
        name: nameMap.get(r.categoryId) ?? r.categoryId,
        amount: amt,
        prev: prevMap.get(r.categoryId) ?? 0,
      });
    }

    list.sort((a, b) => b.amount - a.amount);
    const top = list.slice(0, EXPENSE_TOP_N);
    const other = list.slice(EXPENSE_TOP_N);

    const resultCategories: ExpenseCategoryItemDto[] = top.map((item) => ({
      categoryId: item.id,
      name: item.name,
      amount: item.amount,
      previousAmount: item.prev,
      percentage:
        curTotal > 0 ? Math.round((item.amount / curTotal) * 100 * 10) / 10 : 0,
    }));

    if (other.length > 0) {
      let otherAmount = 0;
      let otherPrev = 0;
      for (const o of other) {
        otherAmount += o.amount;
        otherPrev += o.prev;
      }
      resultCategories.push({
        categoryId: 'other',
        name: 'Other Expenses',
        amount: otherAmount,
        previousAmount: otherPrev,
        percentage:
          curTotal > 0
            ? Math.round((otherAmount / curTotal) * 100 * 10) / 10
            : 0,
      });
    }

    const result: ExpensesByCategoryResponseDto = {
      range: {
        from: range.from,
        to: range.to,
        prevFrom: range.prevFrom,
        prevTo: range.prevTo,
        granularity: range.granularity,
      },
      categories: resultCategories,
      total: curTotal,
      previousTotal: prevTotal,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getInventoryAging(shopId: string): Promise<InventoryAgingResponseDto> {
    const cacheKey = `shop:${shopId}:inv-aging`;
    const cached = this.cache.get<InventoryAgingResponseDto>(cacheKey);
    if (cached) return cached;

    const [bucketRows, conditionRows, accessoriesRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{ bucket: string; cnt: bigint; cost_value: bigint }>
      >(Prisma.sql`
        WITH aged AS (
          SELECT unit_cost,
                 (
                   (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Karachi')::date
                   - (created_at AT TIME ZONE 'Asia/Karachi')::date
                 ) AS age_days
          FROM inventory_units
          WHERE shop_id = ${shopId}::uuid AND status = 'IN_STOCK'
        )
        SELECT CASE
                 WHEN age_days <= 15 THEN '0-15'
                 WHEN age_days <= 30 THEN '16-30'
                 WHEN age_days <= 60 THEN '31-60'
                 WHEN age_days <= 90 THEN '61-90'
                 ELSE '90+'
               END AS bucket,
               COUNT(*)::bigint AS cnt,
               COALESCE(SUM(unit_cost), 0)::bigint AS cost_value
        FROM aged
        GROUP BY 1
      `),
      this.prisma.$queryRaw<
        Array<{
          condition: string;
          cnt: bigint;
          cost_value: bigint;
        }>
      >(Prisma.sql`
        SELECT condition::text AS condition,
               COUNT(*)::bigint AS cnt,
               COALESCE(SUM(unit_cost), 0)::bigint AS cost_value
        FROM inventory_units
        WHERE shop_id = ${shopId}::uuid AND status = 'IN_STOCK'
        GROUP BY condition
      `),
      this.prisma.$queryRaw<Array<{ accessories_value: bigint }>>(Prisma.sql`
        SELECT COALESCE(
                 SUM(
                   CASE
                     WHEN quantity_on_hand > 0
                       THEN quantity_on_hand * avg_unit_cost
                     ELSE 0
                   END
                 ),
                 0
               )::bigint AS accessories_value
        FROM stock_levels
        WHERE shop_id = ${shopId}::uuid
      `),
    ]);

    const bucketsConfig = [
      { key: '0-15', label: '0–15 days' },
      { key: '16-30', label: '16–30 days' },
      { key: '31-60', label: '31–60 days' },
      { key: '61-90', label: '61–90 days' },
      { key: '90+', label: '90+ days' },
    ];
    const bucketMap = new Map(
      bucketRows.map((r) => [
        r.bucket,
        { count: Number(r.cnt), costValue: Number(r.cost_value) },
      ]),
    );

    let phoneStockValue = 0;
    let inStockPhonesCount = 0;
    const agingBuckets: InventoryAgingBucketDto[] = bucketsConfig.map((b) => {
      const hit = bucketMap.get(b.key);
      const count = hit?.count ?? 0;
      const costValue = hit?.costValue ?? 0;
      phoneStockValue += costValue;
      inStockPhonesCount += count;
      return { bucket: b.key, label: b.label, count, costValue };
    });

    let newCount = 0;
    let newCostValue = 0;
    let usedCount = 0;
    let usedCostValue = 0;
    for (const row of conditionRows) {
      if (row.condition === 'NEW') {
        newCount = Number(row.cnt);
        newCostValue = Number(row.cost_value);
      } else {
        usedCount += Number(row.cnt);
        usedCostValue += Number(row.cost_value);
      }
    }

    const accessoriesStockValue = Number(
      accessoriesRows[0]?.accessories_value ?? 0n,
    );
    const conditionSplit: ConditionSplitDto = {
      newCount,
      newCostValue,
      usedCount,
      usedCostValue,
    };

    const result: InventoryAgingResponseDto = {
      totalStockValue: phoneStockValue + accessoriesStockValue,
      phoneStockValue,
      accessoriesStockValue,
      inStockPhonesCount,
      agingBuckets,
      conditionSplit,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getAttention(shopId: string): Promise<AttentionResponseDto> {
    const cacheKey = `shop:${shopId}:attention`;
    const cached = this.cache.get<AttentionResponseDto>(cacheKey);
    if (cached) return cached;

    const today = businessToday();

    const [
      agingResult,
      quantityLowStock,
      serializedLowStock,
      lastReconciliation,
      shop,
    ] = await Promise.all([
      this.receivablesService.getReceivablesAging(shopId),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          current_stock: number;
          threshold: number;
        }>
      >(Prisma.sql`
        SELECT p.id, p.name,
               COALESCE(sl.quantity_on_hand, 0)::int AS current_stock,
               p.low_stock_threshold AS threshold
        FROM products p
        LEFT JOIN stock_levels sl ON sl.product_id = p.id
        WHERE p.shop_id = ${shopId}::uuid
          AND p.is_active = true
          AND p.tracking_type = 'QUANTITY'
          AND COALESCE(sl.quantity_on_hand, 0) <= p.low_stock_threshold
        ORDER BY (COALESCE(sl.quantity_on_hand, 0) - p.low_stock_threshold) ASC
        LIMIT ${LOW_STOCK_LIMIT}
      `),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          current_stock: number;
          threshold: number;
        }>
      >(Prisma.sql`
        SELECT p.id, p.name,
               (
                 SELECT COUNT(*)::int FROM inventory_units iu
                 WHERE iu.product_id = p.id AND iu.status = 'IN_STOCK'
               ) AS current_stock,
               p.low_stock_threshold AS threshold
        FROM products p
        WHERE p.shop_id = ${shopId}::uuid
          AND p.is_active = true
          AND p.tracking_type = 'SERIALIZED'
          AND (
            SELECT COUNT(*) FROM inventory_units iu
            WHERE iu.product_id = p.id AND iu.status = 'IN_STOCK'
          ) <= p.low_stock_threshold
        ORDER BY (
          (SELECT COUNT(*) FROM inventory_units iu
           WHERE iu.product_id = p.id AND iu.status = 'IN_STOCK')
          - p.low_stock_threshold
        ) ASC
        LIMIT ${LOW_STOCK_LIMIT}
      `),
      this.prisma.cashReconciliation.findFirst({
        where: { shopId },
        orderBy: { reconciledAt: 'desc' },
        select: {
          reconciledAt: true,
          difference: true,
          reason: true,
        },
      }),
      this.prisma.shop.findUnique({
        where: { id: shopId },
        select: { subscriptionEndsAt: true },
      }),
    ]);

    const overdueDebtors = agingResult.topDebtors
      .filter((d) => d.oldestDays > 0)
      .map((d) => ({
        customerId: d.customerId,
        name: d.name,
        amount: d.amount,
        overdueDays: d.oldestDays,
      }));

    const totalOverdueAmount = overdueDebtors.reduce(
      (sum, d) => sum + d.amount,
      0,
    );

    const lowStockList: AttentionLowStockProductDto[] = [
      ...quantityLowStock.map((q) => ({
        productId: q.id,
        name: q.name,
        currentStock: q.current_stock,
        threshold: q.threshold,
        trackingType: 'QUANTITY' as const,
      })),
      ...serializedLowStock.map((s) => ({
        productId: s.id,
        name: s.name,
        currentStock: s.current_stock,
        threshold: s.threshold,
        trackingType: 'SERIALIZED' as const,
      })),
    ];
    lowStockList.sort(
      (a, b) => a.currentStock - a.threshold - (b.currentStock - b.threshold),
    );

    let reconDto: AttentionReconciliationDto | null = null;
    if (lastReconciliation && lastReconciliation.difference !== 0n) {
      reconDto = {
        reconciledAt: lastReconciliation.reconciledAt.toISOString(),
        difference: Number(lastReconciliation.difference),
        reason: lastReconciliation.reason,
      };
    }

    let subscriptionDaysLeft: number | null = null;
    if (shop?.subscriptionEndsAt) {
      const endsDateStr = shop.subscriptionEndsAt.toISOString().slice(0, 10);
      const days = daysBetween(today, endsDateStr) - 1;
      if (days <= 7) {
        subscriptionDaysLeft = Math.max(0, days);
      }
    }

    const result: AttentionResponseDto = {
      overdueUdhar: {
        count: overdueDebtors.length,
        totalAmount: totalOverdueAmount,
        topCustomers: overdueDebtors.slice(0, 3),
      },
      lowStock: lowStockList.slice(0, LOW_STOCK_LIMIT),
      cashReconciliationDifference: reconDto,
      subscriptionDaysLeft,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }
}
