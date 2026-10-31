# Ronaq Store Backend — Audit Report & Bug Tracking

This document tracks all audit findings, security reviews, and bug fixes for `ronaq-store-backend` (NestJS 12, Prisma 7, PostgreSQL 17).

## Status Legend
- **OPEN**: Bug identified, evidence documented, not yet fixed.
- **FIXED**: Bug fixed, unit/integration/e2e tests pass, real-world testing verified, and regressions checked.
- **PARTIALLY FIXED**: Fix partially implemented or awaiting further verification.

---

## 1. Tools & Baseline Summary

| Tool | Command | Result | Notes |
|---|---|---|---|
| Typecheck | `npm run typecheck` | PASS (exit 0) | `tsc --noEmit -p tsconfig.build.json` clean |
| Linter | `npm run lint` | PASS (exit 0) | ESLint clean across all `src` and `test` files |
| Unit & Integration Tests | `npm run test` | PASS (exit 0) | 81 test suites, 980 tests passed |
| Production Build | `npm run build` | PASS (exit 0) | Prisma Client (7.10.0) generated, Nest build successful |
| Prisma Schema Validation | `npx prisma validate` | PASS (exit 0) | Multi-file schema valid across all 10 domain models |
| Prisma Migration Status | `npx prisma migrate status` | PASS (exit 0) | 30 migrations applied, up to date |
| Schema vs DB Diff | `npx prisma migrate diff --from-config-datasource --to-schema prisma --exit-code` | PASS (exit 0) | Zero schema-to-database drift |
| Knip (Unused Code) | `npm run knip` | PASS (exit 0) | Zero unused exports/dependencies |
| Code Duplicates | `npm run duplicates` | PASS (exit 0) | 16 clones, 365 lines duplicated (0.99%) |
| Dependency Audit | `npm audit --omit=dev` | 10 vulnerabilities | 2 moderate, 8 high (body-parser, deepmerge-ts, fast-uri, joi, multer, mysql2, qs) |

---

## 2. Findings Summary Table

| ID | Severity | Category | Short Description | Status |
|---|---|---|---|---|
| **BUG-001** | HIGH | Tenant / Subscription | Expired subscription shops remain active & searchable on public storefront & marketplace | FIXED |
| **BUG-002** | HIGH | Money / Accounting | Non-cash customer payments (BANK, JAZZCASH, EASYPAISA) create cash drawer movements AND crash on cancellation | FIXED |
| **BUG-003** | MEDIUM | Idempotency / Concurrency | Inventory adjustments lack `clientRequestId` and double-submit protection | FIXED |
| **BUG-004** | MEDIUM | Security / Resilience | Missing `ParseUUIDPipe` on controller `:id` parameters causes unhandled 500 crashes (PostgreSQL 22P02) | FIXED |
| **BUG-005** | MEDIUM | Security / Error Handling | `GlobalHttpExceptionFilter` does not map Prisma known errors (P2002, P2003, P2025, P2023) to proper HTTP codes | FIXED |
| **BUG-006** | MEDIUM | Business Logic / Integrity | Deactivated/soft-deleted categories and brands can be assigned to new or edited products | FIXED |

---

## 3. Detailed Findings & Fix Evidence

### BUG-001
- **Severity:** HIGH
- **Category:** Tenant Isolation / Storefront / Subscription
- **Location:**
  - `src/store/services/storefront.service.ts`
  - `src/store/helpers/marketplace-filter.helper.ts`
  - `src/store/helpers/marketplace-product-search.helper.ts`
  - `src/store/helpers/marketplace-model-search.helper.ts`
  - `src/store/services/marketplace.service.ts`
- **Why It Was Wrong:**
  While authenticated shop routes properly lock out expired tenants via `AuthGuard`, public storefront and marketplace search helpers only checked `s.status = 'ACTIVE'` and ignored `subscription_ends_at`.
- **Status:** FIXED
- **Fix Details:** Added `subscriptionEndsAt: { gt: new Date() }` across `storefront.service.ts` (`getStores` and `resolvePublicStore`), `marketplace-filter.helper.ts` (`marketplaceShopWhere`), and `s.subscription_ends_at > NOW()` in raw SQL queries (`marketplace-product-search.helper.ts` and `marketplace-model-search.helper.ts`), and `marketplace.service.ts` (`countAllProducts`).
- **Verification Evidence:**
  - Unit test in `storefront.service.spec.ts` asserting that an expired shop throws `NotFoundException` on `getStore()`.
  - 16 test suites (95 tests) in `src/store/` passed with 0 failures.

---

### BUG-002
- **Severity:** HIGH
- **Category:** Money & Accounting Correctness / System Crash
- **Location:**
  - `src/payments/services/payments.service.ts` (lines 277–288)
  - `src/payments/services/payments-cancel.service.ts` (lines 160–220)
  - `src/sales/services/sales-cancel.service.ts` (lines 160–205)
- **Why It Was Wrong:**
  PaymentMethod supports `CASH`, `JAZZCASH`, `EASYPAISA`, and `BANK`. Non-cash customer payments previously wrote to physical `CashMovement`. In addition, cancellation flows unconditionally looked up `cashMovement` and threw `NotFoundException: Cash movement for payment not found` when cancelling any non-cash payment or sale with non-cash payments.
- **Status:** FIXED
- **Fix Details:**
  - In `payments.service.ts`: only create a `CashMovement` if `(dto.method ?? PaymentMethod.CASH) === PaymentMethod.CASH`.
  - In `payments-cancel.service.ts`: check `m === PaymentMethod.CASH` before querying `original` cash movement and creating `CashMovementType.REVERSAL`. Non-cash payments bypass cash movement lookups and drawer deductions.
  - In `sales-cancel.service.ts`: in `cancelSale`, only query and reverse cash movements for payments made in cash (`payment.method === PaymentMethod.CASH`).
- **Verification Evidence:**
  - Unit test in `payments.service.spec.ts`: `"cancels a BANK payment without querying or reversing cash movements"`.
  - Unit test in `sales.service.spec.ts`: `"cancels a sale with BANK payments without creating cash movements"`.
  - All 38 tests in `payments.service.spec.ts` and 59 tests in `sales.service.spec.ts` passed.

---

### BUG-003
- **Severity:** MEDIUM
- **Category:** Idempotency & Concurrency
- **Location:**
  - `src/inventory/dto/create-inventory-adjustment.dto.ts`
  - `src/inventory/services/inventory-adjustment.service.ts`
- **Why It Was Wrong:**
  Unlike other write endpoints requiring `clientRequestId`, `POST /inventory/adjustments` lacked idempotency protection. Retrying a damaged or lost stock adjustment resulted in duplicate stock deductions.
- **Status:** FIXED
- **Fix Details:**
  - Added optional `clientRequestId?: string` with `@IsOptional() @IsUUID()` to `CreateInventoryAdjustmentDto`.
  - In `inventory-adjustment.service.ts`: added pre-check and in-transaction check against `inventoryMovement` with `referenceType: ReferenceType.MANUAL` and `referenceId: dto.clientRequestId`.
- **Verification Evidence:**
  - Unit test in `inventory.service.spec.ts` asserting replayed adjustments return success without duplicate writes.
  - All 40 inventory tests passed with 0 failures.

---

### BUG-004
- **Severity:** MEDIUM
- **Category:** Security / Input Validation / Resilience
- **Location:** Across 16 controllers (`products`, `brands`, `categories`, `customers`, `purchases`, `suppliers`, `expenses`, `payments`, `returns`, `sale-returns`, `supplier-payments`, `expense-categories`, `product-images`, `store-preview`, `store`, `cash-reconciliations`).
- **Why It Was Wrong:**
  All backend entity IDs are PostgreSQL UUIDv7 columns. Route `:id` parameters lacked `new ParseUUIDPipe()`. Passing an invalid string (e.g. `/products/123` or `/customers/undefined`) caused PostgreSQL `22P02`, triggering an unhandled 500 Internal Server Error instead of a 400 Bad Request.
- **Status:** FIXED
- **Fix Details:**
  - Exported `ParseUUIDPipe` from `crud-controller.imports.ts` and `store-controller.imports.ts`.
  - Applied `@Param('id', new ParseUUIDPipe()) id: string` (and corresponding `:customerId`, `:supplierId`, `:imageId`, `:productId`) across all 16 controllers.
- **Verification Evidence:**
  - `npm run typecheck` passed with 0 errors.
  - `npm run lint` clean.
  - 81 test suites (980 tests) passed.

---

### BUG-005
- **Severity:** MEDIUM
- **Category:** Security / Error Handling
- **Location:** `src/common/filters/http-exception.filter.ts`
- **Why It Was Wrong:**
  Prisma client throws `PrismaClientKnownRequestError` for expected database violations (`P2002` unique constraint, `P2003` foreign key, `P2025` record not found, `P2023` invalid input/UUID). The global exception filter fell back to HTTP 500 Internal Server Error.
- **Status:** FIXED
- **Fix Details:**
  - Added Prisma error mapper to `GlobalHttpExceptionFilter`:
    * `P2002` -> HTTP 409 Conflict (`"A resource with this identifier already exists"`)
    * `P2025` / `P2001` -> HTTP 404 Not Found (`"Resource not found"`)
    * `P2003` / `P2023` -> HTTP 400 Bad Request (`"Foreign key constraint violated"` / `"Invalid identifier or data type"`)
- **Verification Evidence:**
  - Added unit tests in `http-exception.filter.spec.ts` asserting that `P2002` maps to 409, `P2025` maps to 404, and `P2023` maps to 400. All 6 tests in `http-exception.filter.spec.ts` passed.

---

### BUG-006
- **Severity:** MEDIUM
- **Category:** Business Logic / Integrity
- **Location:** `src/products/helpers/product-write-guards.helper.ts` (lines 17–44)
- **Why It Was Wrong:**
  Deleting a category or brand sets `isActive: false` (soft deletion). However, `assertCategoryOwned` and `assertBrandOwned` only checked `where: { id, shopId }` without verifying `isActive: true`. As a result, products could be assigned to soft-deleted categories or brands.
- **Status:** FIXED
- **Fix Details:**
  - Added `isActive: true` to the Prisma `where` clause in both `assertCategoryOwned` and `assertBrandOwned`.
  - Updated `products.service.spec.ts` to assert `isActive: true` during category and brand ownership lookups.
- **Verification Evidence:**
  - All 56 tests in `products.service.spec.ts` passed.

---

## 4. Audit Checklist Report (A–F)

- **A. Tenant Isolation:** Verified in all service methods (`sales`, `purchases`, `payments`, `cash`, `inventory`). `shopId` is uniformly extracted from `req.user.shopId` via `AuthGuard`. Cross-tenant references are strictly validated. Storefront mapper strips costs, IMEIs, and supplier info.
- **B. Money & Accounting:** All monetary values use integer `BigInt` (paisa). No floating-point math in financial transactions. Overpayment and underpayment bounds strictly enforced.
- **C. Concurrency & Transactions:** Multi-step writes operate inside `prisma.$transaction`. Critical updates use row-level locks (`SELECT ... FOR UPDATE`) or atomic SQL conditional updates (`quantity_on_hand >= line.quantity`). Idempotency is enforced by `clientRequestId`.
- **D. Inventory:** `SERIALIZED` vs `QUANTITY` rules enforced; tracking type changes locked after the first transaction. Dual-IMEI format, difference, and cross-slot uniqueness verified.
- **E. Database / Prisma:** Zero drift between Prisma schema and PostgreSQL database confirmed by `prisma migrate diff`. Constraints in `constraints.sql` active.
- **F. Auth & Security:** Argon2/Bcrypt password hashing, JWT expiry, constant-time setup token verification, rate limiting on sensitive auth endpoints, and helmet/CORS protections.

