# Dashboard Analytics System Architecture & Metric Definitions

## 1. Metric Definitions (Single Source of Truth)

All metrics strictly filter for `status: ACTIVE` where applicable, excluding cancelled rows. All times and boundaries are computed in the `Asia/Karachi` timezone (UTC+5).

| Metric | Formula | Source Tables | Statuses Included | Existing Reference Code |
| :--- | :--- | :--- | :--- | :--- |
| **Sales Revenue** | $\sum(\text{Sale.totalAmount}) - \sum(\text{SaleReturn.returnAmount})$ (Net Sales) or $\sum(\text{Sale.totalAmount})$ (Gross Sales) | `sales`, `returns` | `RecordStatus.ACTIVE` | `src/dashboard/services/dashboard.service.ts` (L164-166), `src/reports/services/reports-ledger.service.ts` (L98, L432) |
| **Cost of Goods Sold (COGS)** | $\sum(\text{SaleItem.quantity} \times \text{SaleItem.unitCost}) - \sum(\text{ReturnItem.quantity} \times \text{SaleItem.unitCost})$ | `sale_items`, `return_items`, `sales`, `returns` | `RecordStatus.ACTIVE` | `src/dashboard/services/dashboard.service.ts` (L168-176), `src/reports/services/reports-ledger.service.ts` (L91-94) |
| **Returns** | $\sum(\text{SaleReturn.returnAmount})$ | `returns` | `RecordStatus.ACTIVE` | `src/dashboard/services/dashboard.service.ts` (L165), `src/reports/services/reports-ledger.service.ts` (L422, L448-454) |
| **Gross Profit** | $\text{Net Sales} - \text{COGS}$ (or $\text{Gross Sales} - \text{COGS} - \text{Returns}$) | `sales`, `sale_items`, `returns`, `return_items` | `RecordStatus.ACTIVE` | `src/reports/services/reports-ledger.service.ts` (L487) |
| **Expenses** | $\sum(\text{Expense.amount})$ | `expenses` | `RecordStatus.ACTIVE` | `src/dashboard/services/dashboard.service.ts` (L86-93, L178), `src/reports/services/reports-ledger.service.ts` (L347, L441-447) |
| **Net Profit** | $\text{Gross Profit} - \text{Expenses} = \text{Net Sales} - \text{COGS} - \text{Expenses}$ | `sales`, `sale_items`, `returns`, `return_items`, `expenses` | `RecordStatus.ACTIVE` | `src/dashboard/services/dashboard.service.ts` (L179), `src/reports/services/reports-ledger.service.ts` (L490) |
| **Cash in Hand** | $\sum(\text{CashMovement(IN).amount}) - \sum(\text{CashMovement(OUT).amount})$ (ledger balance across all time) | `cash_movements` | Append-only ledger; reversal rows cancel prior movements | `src/dashboard/services/dashboard.service.ts` (L131-135, L201-207), `src/cash/services/cash.service.ts` |
| **Udhar to Collect (Receivables)** | $\sum(\text{Customer.openingBalance}) + \sum(\text{Sale.totalAmount}) - \sum(\text{Payment.amount}) - \sum(\text{SaleReturn.returnAmount}) + \sum(\text{Refund.amount})$ | `customers`, `sales`, `payments`, `returns`, `refunds` | `RecordStatus.ACTIVE` | `src/dashboard/services/dashboard.service.ts` (L181-186), `src/reports/services/reports-analytics.service.ts` (L78-118), `src/customers/services/customers.service.ts` |
| **Payables to Suppliers** | $\sum(\text{Supplier.openingBalance}) + \sum(\text{Purchase.totalAmount}[\text{isOpeningStock}=\text{false}]) - \sum(\text{SupplierPayment.amount})$ | `suppliers`, `purchases`, `supplier_payments` | `RecordStatus.ACTIVE` | `src/dashboard/services/dashboard.service.ts` (L188-192), `src/reports/services/reports-ledger.service.ts` (L277-285), `src/suppliers/services/suppliers.service.ts` |
| **Stock Value** | $\sum(\text{InventoryUnit.unitCost}[\text{status}=\text{IN\_STOCK}]) + \sum(\text{StockLevel.quantityOnHand} \times \text{StockLevel.avgUnitCost})$ | `inventory_units`, `stock_levels` | `UnitStatus.IN_STOCK` for phones | `src/reports/services/reports-analytics.service.ts` (L200-245) |
| **Low-Stock Count** | Count of QUANTITY products where $\text{quantityOnHand} \le \text{lowStockThreshold}$ PLUS SERIALIZED products where $\text{IN\_STOCK count} \le \text{lowStockThreshold}$ | `products`, `stock_levels`, `inventory_units` | `Product.isActive}=\text{true}`, `UnitStatus.IN_STOCK` | `src/dashboard/services/dashboard.service.ts` (L136-162, L193-199) |

---

## 2. Technical Stack & Infrastructure Audit

### Backend (`ronaq-store-backend`)
- **Framework & Runtime**: NestJS 12, Node 24 ESM, Prisma 7 with PostgreSQL (`@prisma/adapter-pg`).
- **Guards & Roles**:
  - `AuthGuard` (`src/auth-guards/auth-guard.ts`): JWT bearer auth for shop users; validates active user, active shop, and valid subscription (`subscriptionEndsAt > now()`). Injects `req.user: AuthenticatedOwner { userId, shopId, role }`.
  - `PlatformAdminGuard` (`src/auth-guards/platform-admin.guard.ts`): JWT bearer auth for SaaS admins (`sub` maps to `PlatformAdmin.id`). Injects `req.user: AuthenticatedPlatformAdmin { adminId, name }`.
- **Existing Dashboard Endpoints**:
  - `GET /dashboard`: Returns simple 7-number snapshot for `period=today`.
  - `GET /platform-admin/shops/overview`: Returns shop count breakdown (`totalShops`, `activeShops`, `trialShops`, `expiredShops`, `suspendedShops`).
  - `GET /platform/dashboard/*`: Super-admin chart APIs (aggregate-only, `PlatformAdminGuard`, in-memory cache TTL **300s**). See §7.
- **Existing Reports Endpoints**:
  - `GET /reports/sales`: Filterable sales list + aggregate summary.
  - `GET /reports/purchases`: Filterable purchase ledger + aggregate summary.
  - `GET /reports/expenses`: Filterable expenses + category breakdown.
  - `GET /reports/profit`: Daily profit matrix (`grossSales`, `cogs`, `returns`, `expenses`, `netProfit`).
  - `GET /reports/customers`: Customer Udhar balances, payments, refunds.
  - `GET /reports/suppliers`: Supplier balances and payables.
  - `GET /reports/inventory`: Valuation and stock status per product.
  - `GET /reports/best-sellers`: Top volume and revenue products.
- **Date & Money Utilities**:
  - Timezone: `Asia/Karachi` (`BUSINESS_TIME_ZONE`).
  - `businessToday()` returns `YYYY-MM-DD` in Karachi local time.
  - `businessDayRange(date)` returns UTC `start` and `end` timestamps matching Karachi 00:00:00 to 24:00:00.
  - `periodRange(period, from, to)` computes standardized date boundaries.
  - `formatPaisaToRupees()` in `src/helpers/csv.helper.ts` formats BigInt integer paisa to display PKR string.
- **Caching Environment**:
  - Neither Redis nor BullMQ are installed in `package.json`.
  - In-memory caching with TTL is standard across the codebase (e.g. `StoreCacheService`, `MarketplaceSearchCacheService`).
  - We implement `DashboardCacheService` as an in-memory TTL cache with automatic cleanup, scoping by `shopId` + serialized params, and fallback to direct query execution upon cache misses.

### Admin Frontend (`ronaq-store-admin`)
- **Framework & Runtime**: Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS v4.
- **Chart Library**:
  - `recharts@3.10.1` is installed.
  - `src/components/ui/chart.tsx` provides full shadcn-style chart primitives (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`).
- **Theme Variables**:
  - All 10 theme presets (`vercel.css`, `whatsapp.css`, `zen.css`, `supabase.css`, etc.) define CSS variables `--chart-1` through `--chart-5` in both light and dark modes.
- **i18n & Navigation**:
  - `next-intl` is configured for English (`en`), Urdu (`ur`), and Pashto (`ps`).
  - RTL direction is handled via HTML `dir='rtl'`, with `isRtl` available in context.

---

## 3. KPI Label Clarification & Renaming

In the current codebase:
- `customerUdhar` was previously rendered in English as `"Credit"`, which led to confusion (often interpreted as store credit balance). In Urdu it was correctly translated as `"ادھار"`.
  - **Renamed to**: `"Customers owe you (Udhar)"` (Urdu: `"کسٹمر ادھار"`, Pashto: `"د کسٹمر پور"`).
- `supplierPayable` was previously rendered in English as `"Due"`, which was ambiguous.
  - **Renamed to**: `"You owe suppliers"` (Urdu: `"سپلائر کا دینا"`, Pashto: `"سپلائر پور"`).

---

## 4. Scaling & Rollup Proposal (Platform Admin)

The database currently hosts 6,000+ shops and is architected to scale to 50,000+.
- All platform queries in Phase 4 use SQL aggregates with indexed scans on `shops(status, subscription_ends_at)`, `shop_store_settings(is_enabled, city)`, and `sales(sale_date, status)`.
- **Proposal for High Scale**: If platform analytics queries on hundreds of thousands of shops exceed 300ms:
  - We propose a lightweight rollup table `platform_daily_stats (date DATE PRIMARY KEY, new_shops INT, active_shops INT, expiring_7d INT, total_sales_count INT)` updated at midnight Karachi time.
  - Since BullMQ is not installed in the repository, this can be triggered by a PostgreSQL `pg_cron` schedule or a NestJS `@Cron()` cron job when enabled.

---

## 5. Phase 1 Implementation & Verification (Shop Owner Endpoints)

### Endpoints Implemented (`/dashboard/shop/*`)
1. `GET /dashboard/shop/kpis`: Current & previous period flow metrics (sales, gross profit, net profit, expenses), snapshot balance metrics (customerUdhar, supplierPayable, cashInHand, lowStockCount), and 14-day sparklines.
2. `GET /dashboard/shop/sales-trend`: Bucketed net sales, gross profit, net profit, orders count with previous period comparison.
3. `GET /dashboard/shop/profit-waterfall`: Stepwise revenue-to-profit breakdown (Gross sales -> Returns -> COGS -> Operating expenses -> Net Profit).
4. `GET /dashboard/shop/cash-flow`: Opening cash balance, bucketed cash-in / cash-out / net change / closing balance, reconciling with cash drawer.
5. `GET /dashboard/shop/receivables-aging`: 0-7, 8-30, 31-60, 60+ days aging brackets and top 5 debtors with oldest days and contact phone numbers.
6. `GET /dashboard/shop/top-products`: Ranked products by revenue, profit, or units sold with margin percentage and tracking type.
7. `GET /dashboard/shop/sales-mix`: IMEI phones vs accessories tracking type split, plus top 5 product categories + other.
8. `GET /dashboard/shop/expenses-by-category`: Category expense distribution with previous period comparison and percentage mix.
9. `GET /dashboard/shop/inventory-aging`: Phone inventory brackets (0-15, 16-30, 31-60, 61-90, 90+ days), condition split (NEW vs USED), and accessories valuation.
10. `GET /dashboard/shop/attention`: Actionable items (overdue debtors, low-stock items with current vs threshold, cash reconciliation discrepancies, subscription expiration warning).

### Architecture & Service Decomposition
- `src/dashboard/helpers/dashboard-date.helper.ts`: Period math, bucket generation, granularity resolution, days between.
- `src/dashboard/services/dashboard-cache.service.ts`: In-memory TTL caching with automatic eviction.
- `src/dashboard/services/dashboard-flow.service.ts`: Flow metrics, sparkline series, and trend aggregations.
- `src/dashboard/services/dashboard-shop.service.ts`: Flow & balance KPIs, profit waterfall, and cash flow ledger series.
- `src/dashboard/services/dashboard-receivables.service.ts`: Receivables aging and overdue debtor identification.
- `src/dashboard/services/dashboard-products.service.ts`: Top products and sales mix breakdown.
- `src/dashboard/services/dashboard-inventory.service.ts`: Expense categories, inventory aging, and owner attention alerts.
- `src/dashboard/controllers/dashboard-shop.controller.ts`: Owner-guarded REST endpoints with Swagger documentation.

### Quality Verification
- Backend quality gate: `npm run check` passed all 37 checks with 0 failures:
  - `secrets`: ok
  - `structure`: ok
  - `module-layout`: ok
  - `max-lines`: ok (all services $\le 350$ lines, controller $\le 280$ lines)
  - `duplicates`: ok (jscpd $\le 1.2\%$)
  - `knip`: ok (zero unused files or exports)
  - `format`: ok (Prettier compliant)
  - `lint`: ok (ESLint compliant)
  - `typecheck`: ok (strict TypeScript compilation)
  - `test`: ok (all 74 test suites, 837 tests passing)
  - `prisma-validate`: ok
  - `build`: ok

---

## 6. Working-tree status (local, not committed)

Dashboard work stays **uncommitted** on `feature/charts` until explicit review. Do **not** push. Do **not** change `.gitignore`.

### Decisions
- **RTL charts**: titles, legends, and KPI text follow document `dir`. Plotting direction for time series stays LTR (dates left→right) so trends stay readable in Urdu/Pashto.
- **Custom period**: `period=custom` + `from`/`to` (`YYYY-MM-DD`). Preset pills clear from/to.
- **Cache**: Redis/BullMQ are not installed; `DashboardCacheService` is in-memory TTL (60s shop / 300s platform), keyed by shopId + params, fails open to live query.
- **Credit / Due rename**: KPI labels are “Customers owe you (Udhar)” and “You owe suppliers”.
- Shop overview: single header; **8 KPI cards**; below-fold rows lazy-mount via IntersectionObserver; `compare` forwarded to shop APIs.

### EXPLAIN (ANALYZE, BUFFERS)
Live EXPLAIN against production-scale data was not run in this environment (no safe prod DB credentials in agent session). Heaviest shop queries to re-run on staging:

1. Sales trend bucket aggregate (`dashboard-flow.service` / sales-trend)
2. Receivables aging debtor rollup (`dashboard-receivables.service`)
3. Inventory aging phone unit buckets (`dashboard-inventory.service`)

Paste staging output under this heading when available. Target: each &lt; 300ms on demo data.

### Still unfinished / follow-ups
- Live EXPLAIN (ANALYZE, BUFFERS) timings on staging/prod-scale DB (not run in agent session — no safe credentials)
- Manual visual QA at 320–1920px, LTR/RTL, light/dark, ≥2 theme presets, demo + empty shop
- Measured endpoint latencies under 300ms on demo data (run after local `APP_ENV=dev npm run seed:demo-analytics`)
- Demo seed covers purchases (opening stock), sales, expenses, payments, aged udhar customers; returns / supplier-payment loops not generated yet
- No git commits (per request); `.gitignore` untouched

### Phase 6 verification (automated)
- Helpers: `dashboard-aging.helper.spec.ts`, `dashboard-reconciliation.helper.spec.ts` (waterfall = KPI net; trend sum; cash closing; udhar total; inventory count; funnel monotonic; shop isolation; owner role)
- Controller: `dashboard-shop.controller.spec.ts` (JWT shopId scoping; non-owner Forbidden)
- Platform: funnel / growth / renewals helpers (existing `dashboard-platform.service.spec.ts`)
- Seed: `APP_ENV=dev npm run seed:demo-analytics` — Nest `createApplicationContext`, uses Sales/Expenses/Payments/Customers/Purchases services only; refuses non-dev and non-localhost unless `ALLOW_REMOTE_SEED=true`; targets shop name `SEED_DEMO_SHOP_NAME` (default **Demo Analytics Shop**)
- Gates: backend `npm run check` EXIT=0; admin `npm run check` EXIT=0 (after platform UI split / lint fixes)

---

## 7. Phase 4 — Platform dashboard backend (`/platform/dashboard/*`)

All routes use **`PlatformAdminGuard` only**. Responses use `ApiSuccessResponseDTO`. Cache: `DashboardCacheService`, TTL **300s**, keys prefixed `platform:`. Timezone: **Asia/Karachi**. Aggregates only — no per-shop revenue, profit, or customer balances (shop metadata matches existing platform-admin list: name, owner phone, city, subscription end).

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/platform/dashboard/kpis` | `totalShops`, `activeShops`, `expiredShops`, `suspendedShops`, `newThisMonth`, `expiringIn7Days`, `shopsWithSaleLast7Days`, `onlineStoreEnabledCount`, `onlineStoreEnabledPercent` |
| GET | `/platform/dashboard/shop-growth?months=12` | `series[]`: `{ month, newShops, cumulative }` + `totalShops` (baseline before window included in cumulative) |
| GET | `/platform/dashboard/renewals?weeks=8` | Weekly expiring counts in `series[]` (ACTIVE, future `subscription_ends_at`) + `nextExpiring` (10 shops) |
| GET | `/platform/dashboard/onboarding-funnel` | Monotonic stages: created → password → product → sale → store enabled → published product |
| GET | `/platform/dashboard/shops-by-city?limit=10` | Top cities from `shop_store_settings.city`, **Other**, blank → **Unknown** |
| GET | `/platform/dashboard/activity?days=30\|90` | Daily platform ACTIVE `salesCount` + distinct selling shops |
| GET | `/platform/dashboard/at-risk` | Paged ACTIVE shops (valid subscription) with no ACTIVE sale in 14 Karachi days |

`GET /platform-admin/shops/overview` unchanged (trial count stays there only).

**Funnel:** each stage uses nested `EXISTS` so every stage is a subset of the previous (non-increasing counts). Published product in the funnel requires password, product, sale, and enabled store on the same shop.

**At-risk:** `Shop.status = ACTIVE`, `subscriptionEndsAt > now`, no ACTIVE sale since start of Karachi day 13 days before today (`daysBackStart(14)`).

**Scaling (10k+ shops):** Chart endpoints stay aggregate / fixed-bucket / TOP-N. `shops-by-city` rolls TOP-N + Other/Unknown **in SQL**. `at-risk` is the only paged list (`page` + `pageSize`, max 100). Renewals list stays `LIMIT 10`. Shop chart endpoints (`top-products`, `sales-mix`, inventory aging, low-stock attention) use SQL `GROUP BY` + `LIMIT` / filtered scans — no full-table load-then-slice. Platform UI fetches below-fold blocks only when they enter the viewport (same lazy pattern as shop dashboard). Cache TTL 300s platform / 60s shop. If p95 &gt; 300ms at scale, propose `platform_daily_stats` rollup (see §4) — do not add without approval.

**Tests:** `dashboard-platform.service.spec.ts` — funnel monotonic helper, growth totals, renewals eligibility filter.

---

## 8. Phase 5 — Platform admin UI (`ronaq-store-admin`)

- Route: `/[locale]/dashboard/platform` → `PlatformDashboard` (split: renewals, cities/activity, at-risk, lazy block).
- Shop owner: `/[locale]/dashboard/overview` → `DukaanDashboard` (8 KPIs, date range + compare, lazy below-fold rows).
- Chart kit: `ChartCard`, `KpiCard`, `DateRangeFilter`, formatters (`Rs` full + Lakh/Crore), `--chart-1`…`--chart-5`.
- RTL decision: chrome RTL; time-series plot LTR (`ChartCard` chart area `dir="ltr"` so Recharts axes stay left→right in Urdu/Pashto).
- Admin `npm run check` must pass (no commits required for local work).

### Aging rule (receivables)
When `Sale.dueDate` is set and before today (Karachi), overdue days = days past due (exclusive). Otherwise use sale age from `saleDate`. Opening balance without sales is allocated to the **60+** bucket.

