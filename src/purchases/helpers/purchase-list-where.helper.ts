import { Prisma } from '../../generated/prisma/client.js';
import { dateColumnRange } from '../../helpers/date.helper.js';
import {
  buildTokenizedSearchAnd,
  splitSearchTokens,
  stripDocSearchPrefix,
} from '../../helpers/tokenized-search.helper.js';
import type { PurchaseQueryFilterDto } from '../dto/purchase-query.filter.js';

export function buildPurchaseListWhere(
  query: PurchaseQueryFilterDto,
  shopId: string,
): Prisma.PurchaseWhereInput {
  const where: Prisma.PurchaseWhereInput = { shopId };
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.payStatus === 'CANCELLED') {
    where.status = 'CANCELLED';
  } else if (query.status === 'ACTIVE' || query.status === 'CANCELLED') {
    where.status = query.status;
  }
  if (query.isOpeningStock !== undefined && query.isOpeningStock !== null) {
    where.isOpeningStock = query.isOpeningStock;
  }
  if (
    query.minTotalAmount !== undefined ||
    query.maxTotalAmount !== undefined
  ) {
    where.totalAmount = {};
    if (query.minTotalAmount !== undefined) {
      where.totalAmount.gte = BigInt(query.minTotalAmount);
    }
    if (query.maxTotalAmount !== undefined) {
      where.totalAmount.lte = BigInt(query.maxTotalAmount);
    }
  }

  const andFilters: Prisma.PurchaseWhereInput[] = [];
  if (query.from || query.to) {
    const from = query.from ?? query.to;
    const to = query.to ?? query.from;
    if (from && to) {
      const range = dateColumnRange(from, to);
      andFilters.push({ purchaseDate: { gte: range.gte } });
      andFilters.push({ purchaseDate: { lt: range.lt } });
    }
  }
  andFilters.push(
    ...buildTokenizedSearchAnd<Prisma.PurchaseWhereInput>(
      query.search,
      (token) => {
        const billTerm = stripDocSearchPrefix(token);
        return [
          { purchaseNo: { contains: billTerm, mode: 'insensitive' } },
          { supplierInvoiceRef: { contains: token, mode: 'insensitive' } },
          { supplier: { name: { contains: token, mode: 'insensitive' } } },
        ];
      },
    ),
  );
  if (andFilters.length > 0) where.AND = andFilters;

  return where;
}

export function purchaseListNeedsMoneyJoin(
  query: PurchaseQueryFilterDto,
): boolean {
  return (
    query.minPaidAmount !== undefined ||
    query.maxPaidAmount !== undefined ||
    query.minOutstandingAmount !== undefined ||
    query.maxOutstandingAmount !== undefined ||
    query.payStatus === 'PAID' ||
    query.payStatus === 'PARTIAL' ||
    query.payStatus === 'PAYABLE' ||
    query.payStatus === 'CANCELLED' ||
    query.sortBy === 'paid' ||
    query.sortBy === 'outstanding'
  );
}

function buildPurchaseMoneyConditions(
  query: PurchaseQueryFilterDto,
  shopId: string,
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`p.shop_id = ${shopId}::uuid`];

  if (query.supplierId) {
    conditions.push(Prisma.sql`p.supplier_id = ${query.supplierId}::uuid`);
  }
  if (query.status === 'ACTIVE' || query.status === 'CANCELLED') {
    conditions.push(Prisma.sql`p.status = ${query.status}`);
  }
  if (query.isOpeningStock === true) {
    conditions.push(Prisma.sql`p.is_opening_stock = true`);
  } else if (query.isOpeningStock === false) {
    conditions.push(Prisma.sql`p.is_opening_stock = false`);
  }
  if (query.from || query.to) {
    const from = query.from ?? query.to;
    const to = query.to ?? query.from;
    if (from && to) {
      const range = dateColumnRange(from, to);
      conditions.push(Prisma.sql`p.purchase_date >= ${range.gte}`);
      conditions.push(Prisma.sql`p.purchase_date < ${range.lt}`);
    }
  }
  if (query.minTotalAmount !== undefined) {
    conditions.push(Prisma.sql`p.total_amount >= ${query.minTotalAmount}`);
  }
  if (query.maxTotalAmount !== undefined) {
    conditions.push(Prisma.sql`p.total_amount <= ${query.maxTotalAmount}`);
  }
  if (query.minPaidAmount !== undefined) {
    conditions.push(
      Prisma.sql`COALESCE(pay.paid_amount, 0) >= ${query.minPaidAmount}`,
    );
  }
  if (query.maxPaidAmount !== undefined) {
    conditions.push(
      Prisma.sql`COALESCE(pay.paid_amount, 0) <= ${query.maxPaidAmount}`,
    );
  }
  if (query.minOutstandingAmount !== undefined) {
    conditions.push(Prisma.sql`
      CASE
        WHEN p.status = 'CANCELLED' OR p.is_opening_stock THEN 0
        ELSE GREATEST(p.total_amount - COALESCE(pay.paid_amount, 0), 0)
      END >= ${query.minOutstandingAmount}
    `);
  }
  if (query.maxOutstandingAmount !== undefined) {
    conditions.push(Prisma.sql`
      CASE
        WHEN p.status = 'CANCELLED' OR p.is_opening_stock THEN 0
        ELSE GREATEST(p.total_amount - COALESCE(pay.paid_amount, 0), 0)
      END <= ${query.maxOutstandingAmount}
    `);
  }
  if (query.payStatus === 'PAID') {
    conditions.push(Prisma.sql`
      p.status = 'ACTIVE'
      AND (
        p.is_opening_stock = true
        OR COALESCE(pay.paid_amount, 0) >= p.total_amount
      )
    `);
  } else if (query.payStatus === 'PARTIAL') {
    conditions.push(Prisma.sql`
      p.status = 'ACTIVE'
      AND p.is_opening_stock = false
      AND COALESCE(pay.paid_amount, 0) > 0
      AND COALESCE(pay.paid_amount, 0) < p.total_amount
    `);
  } else if (query.payStatus === 'PAYABLE') {
    conditions.push(Prisma.sql`
      p.status = 'ACTIVE'
      AND p.is_opening_stock = false
      AND COALESCE(pay.paid_amount, 0) <= 0
    `);
  } else if (query.payStatus === 'CANCELLED') {
    conditions.push(Prisma.sql`p.status = 'CANCELLED'`);
  }

  for (const token of splitSearchTokens(query.search)) {
    const billTerm = `%${stripDocSearchPrefix(token)}%`;
    const nameTerm = `%${token}%`;
    conditions.push(Prisma.sql`
      (
        p.purchase_no ILIKE ${billTerm}
        OR COALESCE(p.supplier_invoice_ref, '') ILIKE ${nameTerm}
        OR EXISTS (
          SELECT 1 FROM suppliers s
          WHERE s.id = p.supplier_id AND s.name ILIKE ${nameTerm}
        )
      )
    `);
  }

  return conditions;
}

const PURCHASE_MONEY_FROM = Prisma.sql`
  FROM purchases p
  LEFT JOIN (
    SELECT purchase_id, COALESCE(SUM(amount), 0) AS paid_amount
    FROM supplier_payments
    WHERE status = 'ACTIVE' AND purchase_id IS NOT NULL
    GROUP BY purchase_id
  ) pay ON pay.purchase_id = p.id
`;

export function buildPurchaseMoneyFilterSql(
  query: PurchaseQueryFilterDto,
  shopId: string,
): Prisma.Sql {
  const conditions = buildPurchaseMoneyConditions(query, shopId);
  return Prisma.sql`
    SELECT p.id
    ${PURCHASE_MONEY_FROM}
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
}

function purchaseMoneySortSql(
  sortBy: 'paid' | 'outstanding',
  sortOrder: 'asc' | 'desc',
): Prisma.Sql {
  const direction = sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  if (sortBy === 'paid') {
    return Prisma.sql`COALESCE(pay.paid_amount, 0) ${direction}, p.id ASC`;
  }
  return Prisma.sql`
    CASE
      WHEN p.status = 'CANCELLED' OR p.is_opening_stock THEN 0
      ELSE GREATEST(p.total_amount - COALESCE(pay.paid_amount, 0), 0)
    END ${direction},
    p.id ASC
  `;
}

export function buildPurchaseMoneyOrderedIdsSql(
  query: PurchaseQueryFilterDto,
  shopId: string,
  sortBy: 'paid' | 'outstanding',
  sortOrder: 'asc' | 'desc',
): Prisma.Sql {
  const conditions = buildPurchaseMoneyConditions(query, shopId);
  return Prisma.sql`
    SELECT p.id
    ${PURCHASE_MONEY_FROM}
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY ${purchaseMoneySortSql(sortBy, sortOrder)}
  `;
}
