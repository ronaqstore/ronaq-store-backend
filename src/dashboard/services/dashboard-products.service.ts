import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TrackingType } from '../../generated/prisma/enums.js';
import { resolveDashboardRange } from '../helpers/dashboard-date.helper.js';
import { DashboardCacheService } from './dashboard-cache.service.js';
import { ShopDashboardQueryDto } from '../dto/shop/shop-dashboard-query.dto.js';
import {
  TopProductItemDto,
  TopProductsResponseDto,
} from '../dto/shop/top-products.dto.js';
import {
  SalesMixCategoryDto,
  SalesMixResponseDto,
  SalesMixTrackingDto,
} from '../dto/shop/sales-mix.dto.js';

const CATEGORY_TOP_N = 5;

@Injectable()
export class DashboardProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DashboardCacheService,
  ) {}

  async getTopProducts(
    shopId: string,
    query: ShopDashboardQueryDto,
  ): Promise<TopProductsResponseDto> {
    const metric = query.metric ?? 'revenue';
    const limit = query.limit ?? 10;
    const cacheKey = `shop:${shopId}:top-prod:${query.period ?? ''}:${query.from ?? ''}:${query.to ?? ''}:${metric}:${limit}`;
    const cached = this.cache.get<TopProductsResponseDto>(cacheKey);
    if (cached) return cached;

    const range = resolveDashboardRange(query.period, query.from, query.to);
    const orderExpr =
      metric === 'profit'
        ? Prisma.sql`(SUM(si.total) - SUM(si.unit_cost * si.quantity))`
        : metric === 'units'
          ? Prisma.sql`SUM(si.quantity)`
          : Prisma.sql`SUM(si.total)`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        product_id: string;
        name: string;
        brand: string;
        tracking_type: string;
        revenue: bigint;
        cost: bigint;
        units: number;
      }>
    >(Prisma.sql`
      SELECT si.product_id,
             p.name,
             b.name AS brand,
             p.tracking_type::text AS tracking_type,
             SUM(si.total)::bigint AS revenue,
             SUM(si.unit_cost * si.quantity)::bigint AS cost,
             SUM(si.quantity)::int AS units
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN products p ON p.id = si.product_id
      INNER JOIN brands b ON b.id = p.brand_id
      WHERE si.shop_id = ${shopId}::uuid
        AND s.status = 'ACTIVE'
        AND s.sale_date >= ${range.start}
        AND s.sale_date <= ${range.end}
      GROUP BY si.product_id, p.name, b.name, p.tracking_type
      ORDER BY ${orderExpr} DESC
      LIMIT ${limit}
    `);

    const items: TopProductItemDto[] = rows.map((row) => {
      const revenue = Number(row.revenue);
      const cost = Number(row.cost);
      const profit = revenue - cost;
      const marginPct =
        revenue > 0 ? Math.round((profit / revenue) * 100 * 10) / 10 : 0;
      let value = revenue;
      if (metric === 'profit') value = profit;
      else if (metric === 'units') value = row.units;
      return {
        productId: row.product_id,
        name: row.name,
        brand: row.brand,
        trackingType: row.tracking_type,
        value,
        marginPct,
        unitsSold: row.units,
      };
    });

    const result: TopProductsResponseDto = {
      range: {
        from: range.from,
        to: range.to,
        prevFrom: range.prevFrom,
        prevTo: range.prevTo,
        granularity: range.granularity,
      },
      metric,
      items,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }

  async getSalesMix(
    shopId: string,
    query: ShopDashboardQueryDto,
  ): Promise<SalesMixResponseDto> {
    const cacheKey = `shop:${shopId}:sales-mix:${query.period ?? ''}:${query.from ?? ''}:${query.to ?? ''}`;
    const cached = this.cache.get<SalesMixResponseDto>(cacheKey);
    if (cached) return cached;

    const range = resolveDashboardRange(query.period, query.from, query.to);

    const [trackingRows, categoryRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          tracking_type: string;
          revenue: bigint;
          cost: bigint;
          units: number;
        }>
      >(Prisma.sql`
        SELECT p.tracking_type::text AS tracking_type,
               SUM(si.total)::bigint AS revenue,
               SUM(si.unit_cost * si.quantity)::bigint AS cost,
               SUM(si.quantity)::int AS units
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        INNER JOIN products p ON p.id = si.product_id
        WHERE si.shop_id = ${shopId}::uuid
          AND s.status = 'ACTIVE'
          AND s.sale_date >= ${range.start}
          AND s.sale_date <= ${range.end}
        GROUP BY p.tracking_type
      `),
      this.prisma.$queryRaw<
        Array<{
          category_id: string;
          name: string;
          revenue: bigint;
          cost: bigint;
          rn: number;
        }>
      >(Prisma.sql`
        WITH cat AS (
          SELECT p.category_id,
                 c.name,
                 SUM(si.total)::bigint AS revenue,
                 SUM(si.unit_cost * si.quantity)::bigint AS cost
          FROM sale_items si
          INNER JOIN sales s ON s.id = si.sale_id
          INNER JOIN products p ON p.id = si.product_id
          INNER JOIN categories c ON c.id = p.category_id
          WHERE si.shop_id = ${shopId}::uuid
            AND s.status = 'ACTIVE'
            AND s.sale_date >= ${range.start}
            AND s.sale_date <= ${range.end}
          GROUP BY p.category_id, c.name
        )
        SELECT category_id, name, revenue, cost,
               ROW_NUMBER() OVER (ORDER BY revenue DESC)::int AS rn
        FROM cat
      `),
    ]);

    const trackingDefaults = new Map<
      string,
      { label: string; revenue: number; profit: number; units: number }
    >([
      [
        TrackingType.SERIALIZED,
        { label: 'Phones (IMEI)', revenue: 0, profit: 0, units: 0 },
      ],
      [
        TrackingType.QUANTITY,
        { label: 'Accessories', revenue: 0, profit: 0, units: 0 },
      ],
    ]);

    let totalRevenue = 0;
    let totalProfit = 0;
    for (const row of trackingRows) {
      const revenue = Number(row.revenue);
      const profit = revenue - Number(row.cost);
      totalRevenue += revenue;
      totalProfit += profit;
      const entry = trackingDefaults.get(row.tracking_type);
      if (entry) {
        entry.revenue = revenue;
        entry.profit = profit;
        entry.units = row.units;
      }
    }

    const byTrackingType: SalesMixTrackingDto[] = Array.from(
      trackingDefaults.entries(),
    ).map(([trackingType, data]) => ({
      trackingType,
      label: data.label,
      revenue: data.revenue,
      profit: data.profit,
      units: data.units,
      percentage:
        totalRevenue > 0
          ? Math.round((data.revenue / totalRevenue) * 100 * 10) / 10
          : 0,
    }));

    const byCategory: SalesMixCategoryDto[] = [];
    let otherRev = 0;
    let otherProfit = 0;
    for (const row of categoryRows) {
      const revenue = Number(row.revenue);
      const profit = revenue - Number(row.cost);
      if (row.rn <= CATEGORY_TOP_N) {
        byCategory.push({
          categoryId: row.category_id,
          name: row.name,
          revenue,
          profit,
          percentage:
            totalRevenue > 0
              ? Math.round((revenue / totalRevenue) * 100 * 10) / 10
              : 0,
        });
      } else {
        otherRev += revenue;
        otherProfit += profit;
      }
    }
    if (otherRev > 0 || otherProfit > 0) {
      byCategory.push({
        categoryId: 'other',
        name: 'Other Categories',
        revenue: otherRev,
        profit: otherProfit,
        percentage:
          totalRevenue > 0
            ? Math.round((otherRev / totalRevenue) * 100 * 10) / 10
            : 0,
      });
    }

    const result: SalesMixResponseDto = {
      range: {
        from: range.from,
        to: range.to,
        prevFrom: range.prevFrom,
        prevTo: range.prevTo,
        granularity: range.granularity,
      },
      byTrackingType,
      byCategory,
      totals: { revenue: totalRevenue, profit: totalProfit },
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }
}
