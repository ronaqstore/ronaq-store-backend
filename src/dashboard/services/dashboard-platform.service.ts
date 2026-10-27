import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  businessDayRange,
  businessToday,
  shiftDays,
} from '../../helpers/date.helper.js';
import {
  getSkipNumber,
  normalizePagination,
} from '../../helpers/paginate-helper.js';
import {
  daysBackStart,
  monthKeysEndingAt,
} from '../helpers/dashboard-platform-date.helper.js';
import { PLATFORM_DASHBOARD_CACHE_TTL_SECONDS } from '../helpers/dashboard-platform.helper.js';
import { DashboardCacheService } from './dashboard-cache.service.js';
import type { PlatformDashboardQueryDto } from '../dto/platform/platform-dashboard-query.dto.js';
import type {
  ActivityResponseDto,
  AtRiskResponseDto,
  OnboardingFunnelResponseDto,
  PlatformKpisDto,
  RenewalsResponseDto,
  ShopGrowthResponseDto,
  ShopsByCityResponseDto,
} from '../dto/platform/platform-dashboard-responses.dto.js';

@Injectable()
export class DashboardPlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DashboardCacheService,
  ) {}

  private cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get<T>(key);
    if (hit !== undefined) return Promise.resolve(hit);
    return loader().then((value) => {
      this.cache.set(key, value, PLATFORM_DASHBOARD_CACHE_TTL_SECONDS);
      return value;
    });
  }

  async getKpis(): Promise<PlatformKpisDto> {
    return this.cached('platform:kpis', async () => {
      const now = new Date();
      const today = businessToday(now);
      const monthStart = `${today.slice(0, 7)}-01`;
      const { start: monthStartUtc } = businessDayRange(monthStart);
      const in7 = new Date(now.getTime() + 7 * 86400000);
      const last7 = new Date(now.getTime() - 7 * 86400000);

      const [
        totalShops,
        activeShops,
        expiredShops,
        suspendedShops,
        newThisMonth,
        expiringIn7Days,
        saleShops,
        onlineEnabled,
      ] = await Promise.all([
        this.prisma.shop.count(),
        this.prisma.shop.count({
          where: { status: 'ACTIVE', subscriptionEndsAt: { gt: now } },
        }),
        this.prisma.shop.count({
          where: { status: 'ACTIVE', subscriptionEndsAt: { lte: now } },
        }),
        this.prisma.shop.count({ where: { status: 'SUSPENDED' } }),
        this.prisma.shop.count({
          where: { createdAt: { gte: monthStartUtc } },
        }),
        this.prisma.shop.count({
          where: {
            status: 'ACTIVE',
            subscriptionEndsAt: { gt: now, lte: in7 },
          },
        }),
        this.prisma.$queryRaw<Array<{ c: bigint }>>(Prisma.sql`
          SELECT COUNT(DISTINCT shop_id)::bigint AS c
          FROM sales
          WHERE status = 'ACTIVE' AND sale_date >= ${last7}
        `),
        this.prisma.shopStoreSettings.count({ where: { isEnabled: true } }),
      ]);

      const shopsWithSaleLast7Days = Number(saleShops[0]?.c ?? 0);
      const onlineStoreEnabledPercent =
        totalShops > 0
          ? Math.round((onlineEnabled / totalShops) * 1000) / 10
          : 0;

      return {
        totalShops,
        activeShops,
        expiredShops,
        suspendedShops,
        newThisMonth,
        expiringIn7Days,
        shopsWithSaleLast7Days,
        onlineStoreEnabledCount: onlineEnabled,
        onlineStoreEnabledPercent,
      };
    });
  }

  async getShopGrowth(
    query: PlatformDashboardQueryDto,
  ): Promise<ShopGrowthResponseDto> {
    const months = query.months ?? 12;
    return this.cached(`platform:growth:${months}`, async () => {
      const keys = monthKeysEndingAt(months);
      const startKey = keys[0] ?? businessToday().slice(0, 7);
      const [y, m] = startKey.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1) - 5 * 60 * 60 * 1000);
      const rows = await this.prisma.$queryRaw<
        Array<{ month: string; new_shops: bigint }>
      >(Prisma.sql`
        SELECT to_char(created_at AT TIME ZONE 'Asia/Karachi', 'YYYY-MM') AS month,
               COUNT(*)::bigint AS new_shops
        FROM shops
        WHERE created_at >= ${start}
        GROUP BY 1
        ORDER BY 1 ASC
      `);
      const totalShops = await this.prisma.shop.count();
      const before = await this.prisma.shop.count({
        where: { createdAt: { lt: start } },
      });
      let cumulative = before;
      const byMonth = new Map(rows.map((r) => [r.month, Number(r.new_shops)]));
      const series: ShopGrowthResponseDto['series'] = keys.map((key) => {
        const newShops = byMonth.get(key) ?? 0;
        cumulative += newShops;
        return { month: key, newShops, cumulative };
      });
      return { series, totalShops };
    });
  }

  async getRenewals(
    query: PlatformDashboardQueryDto,
  ): Promise<RenewalsResponseDto> {
    const weeks = query.weeks ?? 8;
    return this.cached(`platform:renewals:${weeks}`, async () => {
      const now = new Date();
      const today = businessToday(now);
      const endDate = shiftDays(today, weeks * 7);
      const { end: rangeEnd } = businessDayRange(endDate);

      const buckets = await this.prisma.$queryRaw<
        Array<{ week_start: string; expiring_count: bigint }>
      >(Prisma.sql`
        SELECT to_char(
                 date_trunc('week', subscription_ends_at AT TIME ZONE 'Asia/Karachi'),
                 'YYYY-MM-DD'
               ) AS week_start,
               COUNT(*)::bigint AS expiring_count
        FROM shops
        WHERE status = 'ACTIVE'
          AND subscription_ends_at > ${now}
          AND subscription_ends_at < ${rangeEnd}
        GROUP BY 1
        ORDER BY 1 ASC
      `);

      const next = await this.prisma.$queryRaw<
        Array<{
          shop_id: string;
          name: string;
          owner_phone: string | null;
          city: string | null;
          ends_at: Date;
        }>
      >(Prisma.sql`
        SELECT s.id AS shop_id,
               s.name,
               u.phone AS owner_phone,
               ss.city,
               s.subscription_ends_at AS ends_at
        FROM shops s
        LEFT JOIN LATERAL (
          SELECT phone FROM users
          WHERE shop_id = s.id AND role = 'OWNER'
          ORDER BY created_at ASC
          LIMIT 1
        ) u ON true
        LEFT JOIN shop_store_settings ss ON ss.shop_id = s.id
        WHERE s.status = 'ACTIVE'
          AND s.subscription_ends_at > ${now}
        ORDER BY s.subscription_ends_at ASC
        LIMIT 10
      `);

      return {
        series: buckets.map((b) => ({
          weekStart: b.week_start,
          expiringCount: Number(b.expiring_count),
        })),
        nextExpiring: next.map((r) => ({
          id: r.shop_id,
          name: r.name,
          ownerPhone: r.owner_phone,
          city: r.city,
          endsAt: r.ends_at.toISOString(),
        })),
      };
    });
  }

  async getOnboardingFunnel(): Promise<OnboardingFunnelResponseDto> {
    return this.cached('platform:funnel', async () => {
      const rows = await this.prisma.$queryRaw<
        Array<{
          created: bigint;
          password_set: bigint;
          has_product: bigint;
          has_sale: bigint;
          store_enabled: bigint;
          published_product: bigint;
        }>
      >(Prisma.sql`
        WITH base AS (
          SELECT s.id
          FROM shops s
        ),
        with_password AS (
          SELECT b.id FROM base b
          WHERE EXISTS (
            SELECT 1 FROM users u
            WHERE u.shop_id = b.id AND u.role = 'OWNER' AND u.password_hash IS NOT NULL
          )
        ),
        with_product AS (
          SELECT w.id FROM with_password w
          WHERE EXISTS (SELECT 1 FROM products p WHERE p.shop_id = w.id)
        ),
        with_sale AS (
          SELECT w.id FROM with_product w
          WHERE EXISTS (
            SELECT 1 FROM sales s WHERE s.shop_id = w.id AND s.status = 'ACTIVE'
          )
        ),
        with_store AS (
          SELECT w.id FROM with_sale w
          WHERE EXISTS (
            SELECT 1 FROM shop_store_settings ss
            WHERE ss.shop_id = w.id AND ss.is_enabled = true
          )
        ),
        with_published AS (
          SELECT w.id FROM with_store w
          WHERE EXISTS (
            SELECT 1 FROM products p
            WHERE p.shop_id = w.id AND p.is_published = true
          )
        )
        SELECT
          (SELECT COUNT(*) FROM base)::bigint AS created,
          (SELECT COUNT(*) FROM with_password)::bigint AS password_set,
          (SELECT COUNT(*) FROM with_product)::bigint AS has_product,
          (SELECT COUNT(*) FROM with_sale)::bigint AS has_sale,
          (SELECT COUNT(*) FROM with_store)::bigint AS store_enabled,
          (SELECT COUNT(*) FROM with_published)::bigint AS published_product
      `);

      const r = rows[0];
      const counts = [
        Number(r?.created ?? 0),
        Number(r?.password_set ?? 0),
        Number(r?.has_product ?? 0),
        Number(r?.has_sale ?? 0),
        Number(r?.store_enabled ?? 0),
        Number(r?.published_product ?? 0),
      ];
      const labels = [
        { key: 'created', label: 'Shops created' },
        { key: 'password_set', label: 'Owner password set' },
        { key: 'has_product', label: 'At least 1 product' },
        { key: 'has_sale', label: 'At least 1 sale' },
        { key: 'store_enabled', label: 'Store enabled' },
        { key: 'published_product', label: 'Published product' },
      ];

      return {
        stages: labels.map((meta, i) => {
          const prev = i === 0 ? counts[0] : counts[i - 1];
          const count = counts[i];
          const dropOffPct =
            prev > 0 ? Math.round(((prev - count) / prev) * 1000) / 10 : 0;
          return { ...meta, count, dropOffPct };
        }),
      };
    });
  }

  async getShopsByCity(
    query: PlatformDashboardQueryDto,
  ): Promise<ShopsByCityResponseDto> {
    const limit = query.limit ?? 10;
    return this.cached(`platform:cities:${limit}`, async () => {
      const rows = await this.prisma.$queryRaw<
        Array<{ city: string; shop_count: bigint; sort_ord: number }>
      >(Prisma.sql`
        WITH city_counts AS (
          SELECT NULLIF(BTRIM(ss.city), '') AS city,
                 COUNT(*)::bigint AS shop_count
          FROM shops s
          LEFT JOIN shop_store_settings ss ON ss.shop_id = s.id
          GROUP BY 1
        ),
        ranked AS (
          SELECT city, shop_count,
                 ROW_NUMBER() OVER (ORDER BY shop_count DESC)::int AS rn
          FROM city_counts
          WHERE city IS NOT NULL
        )
        SELECT city, shop_count, sort_ord FROM (
          SELECT city, shop_count, rn AS sort_ord
          FROM ranked
          WHERE rn <= ${limit}
          UNION ALL
          SELECT 'Other',
                 COALESCE((SELECT SUM(shop_count) FROM ranked WHERE rn > ${limit}), 0)::bigint,
                 ${limit + 1}
          WHERE EXISTS (SELECT 1 FROM ranked WHERE rn > ${limit})
          UNION ALL
          SELECT 'Unknown',
                 COALESCE((SELECT SUM(shop_count) FROM city_counts WHERE city IS NULL), 0)::bigint,
                 ${limit + 2}
          WHERE EXISTS (SELECT 1 FROM city_counts WHERE city IS NULL)
        ) capped
        ORDER BY sort_ord
      `);

      return {
        buckets: rows
          .filter((r) => Number(r.shop_count) > 0)
          .map((r) => ({
            city: r.city,
            shopCount: Number(r.shop_count),
          })),
      };
    });
  }

  async getActivity(
    query: PlatformDashboardQueryDto,
  ): Promise<ActivityResponseDto> {
    const days = query.days ?? 30;
    return this.cached(`platform:activity:${days}`, async () => {
      const today = businessToday();
      const from = shiftDays(today, -(days - 1));
      const { start } = businessDayRange(from);
      const rows = await this.prisma.$queryRaw<
        Array<{
          day: string;
          sales_count: bigint;
          active_shops: bigint;
        }>
      >(Prisma.sql`
        SELECT to_char(sale_date AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD') AS day,
               COUNT(*)::bigint AS sales_count,
               COUNT(DISTINCT shop_id)::bigint AS active_shops
        FROM sales
        WHERE status = 'ACTIVE' AND sale_date >= ${start}
        GROUP BY 1
        ORDER BY 1 ASC
      `);
      const byDay = new Map(
        rows.map((r) => [
          r.day,
          {
            salesCount: Number(r.sales_count),
            activeShops: Number(r.active_shops),
          },
        ]),
      );
      const series: ActivityResponseDto['series'] = [];
      for (let i = 0; i < days; i++) {
        const date = shiftDays(from, i);
        const hit = byDay.get(date);
        series.push({
          date,
          salesCount: hit?.salesCount ?? 0,
          activeShops: hit?.activeShops ?? 0,
        });
      }
      return { series };
    });
  }

  async getAtRisk(
    query: PlatformDashboardQueryDto,
  ): Promise<AtRiskResponseDto> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const sortBy = query.sortBy ?? 'lastSaleAt';
    const sortOrder = query.sortOrder ?? 'asc';
    const skip = getSkipNumber(page, pageSize);
    return this.cached(
      `platform:atrisk:${page}:${pageSize}:${sortBy}:${sortOrder}`,
      async () => {
        const cutoff = daysBackStart(14);
        const now = new Date();
        const totalRows = await this.prisma.$queryRaw<Array<{ c: bigint }>>(
          Prisma.sql`
            SELECT COUNT(*)::bigint AS c
            FROM shops s
            WHERE s.status = 'ACTIVE'
              AND s.subscription_ends_at > ${now}
              AND NOT EXISTS (
                SELECT 1 FROM sales sa
                WHERE sa.shop_id = s.id
                  AND sa.status = 'ACTIVE'
                  AND sa.sale_date >= ${cutoff}
              )
          `,
        );
        const orderClause = (() => {
          if (sortBy === 'name') {
            return sortOrder === 'desc'
              ? Prisma.sql`s.name DESC`
              : Prisma.sql`s.name ASC`;
          }
          if (sortBy === 'subscriptionEndsAt') {
            return sortOrder === 'desc'
              ? Prisma.sql`s.subscription_ends_at DESC`
              : Prisma.sql`s.subscription_ends_at ASC`;
          }
          return sortOrder === 'desc'
            ? Prisma.sql`last_sale_at DESC NULLS FIRST`
            : Prisma.sql`last_sale_at ASC NULLS LAST`;
        })();

        const items = await this.prisma.$queryRaw<
          Array<{
            shop_id: string;
            name: string;
            city: string | null;
            last_sale_at: Date | null;
            subscription_ends_at: Date;
            owner_phone: string | null;
          }>
        >(Prisma.sql`
          SELECT s.id AS shop_id,
                 s.name,
                 ss.city,
                 (
                   SELECT MAX(sa.sale_date) FROM sales sa
                   WHERE sa.shop_id = s.id AND sa.status = 'ACTIVE'
                 ) AS last_sale_at,
                 s.subscription_ends_at,
                 u.phone AS owner_phone
          FROM shops s
          LEFT JOIN shop_store_settings ss ON ss.shop_id = s.id
          LEFT JOIN LATERAL (
            SELECT phone FROM users
            WHERE shop_id = s.id AND role = 'OWNER'
            ORDER BY created_at ASC
            LIMIT 1
          ) u ON true
          WHERE s.status = 'ACTIVE'
            AND s.subscription_ends_at > ${now}
            AND NOT EXISTS (
              SELECT 1 FROM sales sa
              WHERE sa.shop_id = s.id
                AND sa.status = 'ACTIVE'
                AND sa.sale_date >= ${cutoff}
            )
          ORDER BY ${orderClause}
          LIMIT ${pageSize} OFFSET ${skip}
        `);

        return {
          items: items.map((r) => ({
            id: r.shop_id,
            name: r.name,
            city: r.city,
            lastSaleAt: r.last_sale_at?.toISOString() ?? null,
            subscriptionEndsAt: r.subscription_ends_at.toISOString(),
            ownerPhone: r.owner_phone,
          })),
          total: Number(totalRows[0]?.c ?? 0),
          page,
          pageSize,
        };
      },
    );
  }
}
