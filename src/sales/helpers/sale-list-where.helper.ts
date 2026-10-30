import { Prisma } from '../../generated/prisma/client.js';
import { businessDayRange } from '../../helpers/date.helper.js';
import {
  buildTokenizedSearchAnd,
  splitSearchTokens,
  stripDocSearchPrefix,
} from '../../helpers/tokenized-search.helper.js';
import type { SaleQueryFilterDto } from '../dto/sale-query.filter.js';

export function buildSaleListWhere(
  query: SaleQueryFilterDto,
  shopId: string,
): Prisma.SaleWhereInput {
  const where: Prisma.SaleWhereInput = { shopId };
  if (query.customerId) where.customerId = query.customerId;
  if (query.payStatus === 'CANCELLED') {
    where.status = 'CANCELLED';
  } else if (query.status === 'ACTIVE' || query.status === 'CANCELLED') {
    where.status = query.status;
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

  const andFilters: Prisma.SaleWhereInput[] = [];
  if (query.from) {
    andFilters.push({ saleDate: { gte: businessDayRange(query.from).start } });
  }
  if (query.to) {
    andFilters.push({ saleDate: { lt: businessDayRange(query.to).end } });
  }
  andFilters.push(
    ...buildTokenizedSearchAnd<Prisma.SaleWhereInput>(query.search, (token) => {
      const saleTerm = stripDocSearchPrefix(token);
      return [
        { saleNo: { contains: saleTerm, mode: 'insensitive' } },
        { customer: { name: { contains: token, mode: 'insensitive' } } },
      ];
    }),
  );
  if (andFilters.length > 0) where.AND = andFilters;

  return where;
}

export function saleListNeedsMoneyJoin(query: SaleQueryFilterDto): boolean {
  return (
    query.minPaidAmount !== undefined ||
    query.maxPaidAmount !== undefined ||
    query.minOutstandingAmount !== undefined ||
    query.maxOutstandingAmount !== undefined ||
    query.payStatus === 'PAID' ||
    query.payStatus === 'PARTIAL' ||
    query.payStatus === 'UDHAR' ||
    query.payStatus === 'CANCELLED' ||
    query.sortBy === 'paid' ||
    query.sortBy === 'outstanding'
  );
}

function buildSaleMoneyConditions(
  query: SaleQueryFilterDto,
  shopId: string,
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`s.shop_id = ${shopId}::uuid`];

  if (query.customerId) {
    conditions.push(Prisma.sql`s.customer_id = ${query.customerId}::uuid`);
  }
  if (query.status === 'ACTIVE' || query.status === 'CANCELLED') {
    conditions.push(Prisma.sql`s.status = ${query.status}`);
  }
  if (query.from) {
    conditions.push(
      Prisma.sql`s.sale_date >= ${businessDayRange(query.from).start}`,
    );
  }
  if (query.to) {
    conditions.push(
      Prisma.sql`s.sale_date < ${businessDayRange(query.to).end}`,
    );
  }
  if (query.minTotalAmount !== undefined) {
    conditions.push(Prisma.sql`s.total_amount >= ${query.minTotalAmount}`);
  }
  if (query.maxTotalAmount !== undefined) {
    conditions.push(Prisma.sql`s.total_amount <= ${query.maxTotalAmount}`);
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
        WHEN s.status = 'CANCELLED' THEN 0
        ELSE GREATEST(s.total_amount - COALESCE(pay.paid_amount, 0), 0)
      END >= ${query.minOutstandingAmount}
    `);
  }
  if (query.maxOutstandingAmount !== undefined) {
    conditions.push(Prisma.sql`
      CASE
        WHEN s.status = 'CANCELLED' THEN 0
        ELSE GREATEST(s.total_amount - COALESCE(pay.paid_amount, 0), 0)
      END <= ${query.maxOutstandingAmount}
    `);
  }
  if (query.payStatus === 'PAID') {
    conditions.push(Prisma.sql`
      s.status = 'ACTIVE'
      AND COALESCE(pay.paid_amount, 0) >= s.total_amount
    `);
  } else if (query.payStatus === 'PARTIAL') {
    conditions.push(Prisma.sql`
      s.status = 'ACTIVE'
      AND COALESCE(pay.paid_amount, 0) > 0
      AND COALESCE(pay.paid_amount, 0) < s.total_amount
    `);
  } else if (query.payStatus === 'UDHAR') {
    conditions.push(Prisma.sql`
      s.status = 'ACTIVE'
      AND COALESCE(pay.paid_amount, 0) <= 0
    `);
  } else if (query.payStatus === 'CANCELLED') {
    conditions.push(Prisma.sql`s.status = 'CANCELLED'`);
  }

  for (const token of splitSearchTokens(query.search)) {
    const saleTerm = `%${stripDocSearchPrefix(token)}%`;
    const nameTerm = `%${token}%`;
    conditions.push(Prisma.sql`
      (
        s.sale_no ILIKE ${saleTerm}
        OR EXISTS (
          SELECT 1 FROM customers c
          WHERE c.id = s.customer_id AND c.name ILIKE ${nameTerm}
        )
      )
    `);
  }

  return conditions;
}

const SALE_MONEY_FROM = Prisma.sql`
  FROM sales s
  LEFT JOIN (
    SELECT sale_id, COALESCE(SUM(amount), 0) AS paid_amount
    FROM payments
    WHERE status = 'ACTIVE' AND sale_id IS NOT NULL
    GROUP BY sale_id
  ) pay ON pay.sale_id = s.id
`;

export function buildSaleMoneyFilterSql(
  query: SaleQueryFilterDto,
  shopId: string,
): Prisma.Sql {
  const conditions = buildSaleMoneyConditions(query, shopId);
  return Prisma.sql`
    SELECT s.id
    ${SALE_MONEY_FROM}
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
}

function saleMoneySortSql(
  sortBy: 'paid' | 'outstanding',
  sortOrder: 'asc' | 'desc',
): Prisma.Sql {
  const direction = sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  if (sortBy === 'paid') {
    return Prisma.sql`COALESCE(pay.paid_amount, 0) ${direction}, s.id ASC`;
  }
  return Prisma.sql`
    CASE
      WHEN s.status = 'CANCELLED' THEN 0
      ELSE GREATEST(s.total_amount - COALESCE(pay.paid_amount, 0), 0)
    END ${direction},
    s.id ASC
  `;
}

export function buildSaleMoneyOrderedIdsSql(
  query: SaleQueryFilterDto,
  shopId: string,
  sortBy: 'paid' | 'outstanding',
  sortOrder: 'asc' | 'desc',
): Prisma.Sql {
  const conditions = buildSaleMoneyConditions(query, shopId);
  return Prisma.sql`
    SELECT s.id
    ${SALE_MONEY_FROM}
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY ${saleMoneySortSql(sortBy, sortOrder)}
  `;
}
