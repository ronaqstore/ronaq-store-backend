import { buildAmountRangeFilter } from '../../common-dto/helpers/amount-range-filter.helper.js';
import { Prisma } from '../../generated/prisma/client.js';
import { normalizeCnicOrNull } from '../../helpers/cnic.helper.js';
import { normalizePhone } from '../../helpers/phone.helper.js';
import { buildTokenizedSearchAnd } from '../../helpers/tokenized-search.helper.js';
import type { SupplierQueryFilterDto } from '../dto/supplier-query.filter.js';

function supplierSearchBranches(token: string): Prisma.SupplierWhereInput[] {
  const branches: Prisma.SupplierWhereInput[] = [
    { name: { contains: token, mode: 'insensitive' } },
    { phone: { contains: token, mode: 'insensitive' } },
    { cnic: { contains: token, mode: 'insensitive' } },
    { address: { contains: token, mode: 'insensitive' } },
  ];
  const canonicalPhone = normalizePhone(token);
  if (canonicalPhone && canonicalPhone !== token) {
    branches.push({
      phone: { contains: canonicalPhone, mode: 'insensitive' },
    });
  }
  const digits = token.replace(/\D/g, '');
  if (digits && digits !== token) {
    branches.push({
      cnic: { contains: digits, mode: 'insensitive' },
    });
  }
  const formattedCnic = normalizeCnicOrNull(token);
  if (
    typeof formattedCnic === 'string' &&
    formattedCnic &&
    formattedCnic !== token &&
    formattedCnic !== digits
  ) {
    branches.push({
      cnic: { contains: formattedCnic, mode: 'insensitive' },
    });
  }
  return branches;
}

export function buildSupplierListWhere(
  query: SupplierQueryFilterDto,
  shopId: string,
): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = { shopId };
  const and: Prisma.SupplierWhereInput[] = [
    ...buildTokenizedSearchAnd<Prisma.SupplierWhereInput>(
      query.search,
      supplierSearchBranches,
    ),
  ];

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

export function supplierListNeedsCurrentBalanceJoin(
  query: SupplierQueryFilterDto,
): boolean {
  return (
    query.minCurrentBalance !== undefined ||
    query.maxCurrentBalance !== undefined
  );
}

const SUPPLIER_BALANCE_FROM = Prisma.sql`
  FROM suppliers s
  LEFT JOIN (
    SELECT supplier_id, COALESCE(SUM(total_amount), 0) AS total
    FROM purchases
    WHERE status = 'ACTIVE' AND is_opening_stock = false
    GROUP BY supplier_id
  ) purch_agg ON purch_agg.supplier_id = s.id
  LEFT JOIN (
    SELECT supplier_id, COALESCE(SUM(amount), 0) AS total
    FROM supplier_payments
    WHERE status = 'ACTIVE'
    GROUP BY supplier_id
  ) pay_agg ON pay_agg.supplier_id = s.id
`;

function supplierCurrentBalanceSql(): Prisma.Sql {
  return Prisma.sql`(
    s.opening_balance
    + COALESCE(purch_agg.total, 0)
    - COALESCE(pay_agg.total, 0)
  )`;
}

export function buildSupplierCurrentBalanceFilterSql(
  query: SupplierQueryFilterDto,
  shopId: string,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`s.shop_id = ${shopId}::uuid`];
  const balance = supplierCurrentBalanceSql();

  if (query.minCurrentBalance !== undefined) {
    conditions.push(Prisma.sql`${balance} >= ${query.minCurrentBalance}`);
  }
  if (query.maxCurrentBalance !== undefined) {
    conditions.push(Prisma.sql`${balance} <= ${query.maxCurrentBalance}`);
  }

  return Prisma.sql`
    SELECT s.id
    ${SUPPLIER_BALANCE_FROM}
    WHERE ${Prisma.join(conditions, ' AND ')}
  `;
}
