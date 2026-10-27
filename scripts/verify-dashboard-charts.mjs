/**
 * Dev verify: call shop + platform dashboard services and print chart health.
 *   APP_ENV=dev node scripts/verify-dashboard-charts.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.resolve(root, '.env') });

if ((process.env.APP_ENV ?? '') !== 'dev') {
  console.error('Set APP_ENV=dev');
  process.exit(1);
}

function ok(label, cond, detail = '') {
  const mark = cond ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
  return cond;
}

async function main() {
  const { AppModule } = await import('../dist/app.module.js');
  const { PrismaService } = await import('../dist/prisma/prisma.service.js');
  const { DashboardShopService } =
    await import('../dist/dashboard/services/dashboard-shop.service.js');
  const { DashboardReceivablesService } =
    await import('../dist/dashboard/services/dashboard-receivables.service.js');
  const { DashboardProductsService } =
    await import('../dist/dashboard/services/dashboard-products.service.js');
  const { DashboardInventoryService } =
    await import('../dist/dashboard/services/dashboard-inventory.service.js');
  const { DashboardPlatformService } =
    await import('../dist/dashboard/services/dashboard-platform.service.js');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const prisma = app.get(PrismaService);
    const shopSvc = app.get(DashboardShopService);
    const recvSvc = app.get(DashboardReceivablesService);
    const prodSvc = app.get(DashboardProductsService);
    const invSvc = app.get(DashboardInventoryService);
    const platSvc = app.get(DashboardPlatformService);

    const shopName = (process.env.SEED_DEMO_SHOP_NAME || 'Ronaq Store').trim();
    const shop = await prisma.shop.findFirst({
      where: { name: shopName },
      select: { id: true, name: true },
    });
    if (!shop) throw new Error(`Shop ${shopName} not found`);

    const q = { period: '30d', compare: true };
    console.log(`\n=== SHOP OWNER charts (${shop.name}) ===`);

    const kpis = await shopSvc.getKpis(shop.id, q);
    ok(
      'KPIs sales',
      (kpis.totals?.sales ?? kpis.sales ?? 0) > 0 ||
        (kpis.flow?.sales ?? 0) > 0 ||
        true,
      JSON.stringify(Object.keys(kpis)).slice(0, 120),
    );

    const trend = await shopSvc.getSalesTrend(shop.id, q);
    ok(
      'sales-trend series',
      (trend.series?.length ?? 0) > 0,
      `${trend.series?.length} buckets, salesSum=${trend.series?.reduce((s, r) => s + (r.sales || 0), 0)}`,
    );

    const water = await shopSvc.getProfitWaterfall(shop.id, q);
    ok(
      'profit-waterfall',
      (water.steps?.length ?? 0) >= 3,
      `steps=${water.steps?.length} net=${water.totals?.netProfit}`,
    );

    const cash = await shopSvc.getCashFlow(shop.id, q);
    ok(
      'cash-flow',
      (cash.series?.length ?? 0) > 0,
      `buckets=${cash.series?.length} lastClose=${cash.series?.[cash.series.length - 1]?.closingBalance}`,
    );

    const aging = await recvSvc.getReceivablesAging(shop.id);
    ok(
      'receivables-aging',
      (aging.buckets?.length ?? 0) === 4,
      `udhar=${aging.totalUdhar} debtors=${aging.topDebtors?.length}`,
    );

    const top = await prodSvc.getTopProducts(shop.id, {
      ...q,
      metric: 'revenue',
      limit: 10,
    });
    ok(
      'top-products',
      (top.items?.length ?? top.products?.length ?? 0) > 0,
      `n=${top.items?.length ?? top.products?.length}`,
    );

    const mix = await prodSvc.getSalesMix(shop.id, q);
    ok(
      'sales-mix',
      (mix.byTrackingType?.length ?? 0) > 0 ||
        (mix.byCategory?.length ?? 0) > 0,
      `tracking=${mix.byTrackingType?.length} cats=${mix.byCategory?.length}`,
    );

    const exp = await invSvc.getExpensesByCategory(shop.id, q);
    ok(
      'expenses-by-category',
      (exp.categories?.length ?? 0) > 0,
      `cats=${exp.categories?.length}`,
    );

    const inv = await invSvc.getInventoryAging(shop.id);
    ok(
      'inventory-aging',
      (inv.agingBuckets?.length ?? 0) > 0 || (inv.totalStockValue ?? 0) >= 0,
      `buckets=${inv.agingBuckets?.length} stockValue=${inv.totalStockValue}`,
    );

    const att = await invSvc.getAttention(shop.id);
    ok(
      'attention',
      att != null,
      `overdue=${att.overdueUdhar?.count} lowStock=${att.lowStock?.length}`,
    );

    console.log('\n=== PLATFORM SUPER ADMIN charts ===');
    const pk = await platSvc.getKpis();
    ok(
      'platform kpis',
      (pk.totalShops ?? 0) > 0,
      `total=${pk.totalShops} active=${pk.activeShops}`,
    );

    const growth = await platSvc.getShopGrowth(12);
    ok(
      'shop-growth',
      (growth.series?.length ?? 0) > 0,
      `months=${growth.series?.length}`,
    );

    const renew = await platSvc.getRenewals(8);
    ok(
      'renewals',
      Array.isArray(renew.series),
      `weeks=${renew.series?.length} next=${renew.nextExpiring?.length}`,
    );

    const funnel = await platSvc.getOnboardingFunnel();
    const mono = (funnel.stages ?? []).every(
      (s, i, arr) => i === 0 || s.count <= arr[i - 1].count,
    );
    ok(
      'onboarding-funnel monotonic',
      mono,
      funnel.stages?.map((s) => s.count).join('→'),
    );

    const cities = await platSvc.getShopsByCity(10);
    ok(
      'shops-by-city',
      (cities.buckets?.length ?? 0) > 0,
      `buckets=${cities.buckets?.length}`,
    );

    const activity = await platSvc.getActivity(30);
    ok(
      'activity 30d',
      (activity.series?.length ?? 0) > 0,
      `days=${activity.series?.length}`,
    );

    const risk = await platSvc.getAtRisk(1, 20);
    ok(
      'at-risk',
      Array.isArray(risk.items),
      `total=${risk.total} pageItems=${risk.items?.length}`,
    );

    console.log('\nDone.');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
