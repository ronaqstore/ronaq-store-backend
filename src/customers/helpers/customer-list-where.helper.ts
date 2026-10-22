import { buildAmountRangeFilter } from '../../common-dto/helpers/amount-range-filter.helper.js';
import { Prisma } from '../../generated/prisma/client.js';
import { normalizePhone } from '../../helpers/phone.helper.js';
import type { CustomerQueryFilterDto } from '../dto/customer-query.filter.js';

export function buildCustomerListWhere(
  query: CustomerQueryFilterDto,
  shopId: string,
): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { shopId };
  const and: Prisma.CustomerWhereInput[] = [];

  const search = query.search?.trim();
  if (search) {
    const branches: Prisma.CustomerWhereInput[] = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
    const canonical = normalizePhone(search);
    if (canonical && canonical !== search) {
      branches.push({ phone: { contains: canonical } });
    }
    and.push({ OR: branches });
  }

  const phone = query.phone?.trim();
  if (phone) {
    const branches: Prisma.CustomerWhereInput[] = [
      { phone: { contains: phone } },
    ];
    const canonical = normalizePhone(phone);
    if (canonical && canonical !== phone) {
      branches.push({ phone: { contains: canonical } });
    }
    and.push({ OR: branches });
  }

  const address = query.address?.trim();
  if (address) {
    and.push({ address: { contains: address, mode: 'insensitive' } });
  }

  const openingBalance = buildAmountRangeFilter(
    query.minOpeningBalance,
    query.maxOpeningBalance,
  );
  if (openingBalance) and.push({ openingBalance });

  if (query.isActive !== undefined && query.isActive !== null) {
    where.isActive = query.isActive;
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

export function customerListNeedsCurrentBalanceJoin(
  query: CustomerQueryFilterDto,
): boolean {
  return (
    query.minCurrentBalance !== undefined ||
    query.maxCurrentBalance !== undefined
  );
}

const CUSTOMER_BALANCE_FROM = Prisma.sql`
  FROM customers c
  LEFT JOIN (
    SELECT customer_id, COALESCE(SUM(total_amount), 0) AS total
    FROM sales
    WHERE status = 'ACTIVE' AND customer_id IS NOT NULL
    GROUP BY customer_id
  ) sales_agg ON sales_agg.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE status = 'ACTIVE' AND customer_id IS NOT NULL
    GROUP BY customer_id
  ) pay_agg ON pay_agg.customer_id = c.id
  LEFT JOIN (
    SELECT customer_id, COALESCE(SUM(return_amount), 0) AS total
    FROM returns
    WHERE status = 'ACTIVE' AND customer_id IS NOT NULL
    GROUP BY customer_id
  ) ret_agg ON ret_agg.customer_id = c.id
  LEFT JOIN (
    SELECT sr.customer_id, COALESCE(SUM(rf.amount), 0) AS total
    FROM refunds rf
    INNER JOIN returns sr ON sr.id = rf.return_id
    WHERE sr.status = 'ACTIVE' AND sr.customer_id IS NOT NULL
    GROUP BY sr.customer_id
  ) ref_agg ON ref_agg.customer_id = c.id
`;

function customerCurrentBalanceSql(): Prisma.Sql {
  return Prisma.sql`(
    c.opening_balance
    + COALESCE(sales_agg.total, 0)
    - COALESCE(pay_agg.total, 0)
    - COALESCE(ret_agg.total, 0)
    + COALESCE(ref_agg.total, 0)
  )`;
}

export function buildCustomerCurrentBalanceFilterSql(
  query: CustomerQueryFilterDto,
  shopId: string,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`c.shop_id = ${shopId}::uuid`];
  const balance = customerCurrentBalanceSql();

  if (query.minCurrentBalance !== undefined) {
    conditions.push(Prisma.sql`${balance} >= ${query.minCurrentBalance}`);
  }
  if (query.maxCurrentBalance !== undefined) {
    conditions.push(Prisma.sql`${balance} <= ${query.maxCurrentBalance}`);
  }

  return Prisma.sql`
    SELECT c.id
    ${CUSTOMER_BALANCE_FROM}
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
}
