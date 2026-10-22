import { buildAmountRangeFilter } from '../../common-dto/helpers/amount-range-filter.helper.js';
import { Prisma } from '../../generated/prisma/client.js';
import { normalizePhone } from '../../helpers/phone.helper.js';
import type { SupplierQueryFilterDto } from '../dto/supplier-query.filter.js';

export function buildSupplierListWhere(
  query: SupplierQueryFilterDto,
  shopId: string,
): Prisma.SupplierWhereInput {
  const where: Prisma.SupplierWhereInput = { shopId };
  const and: Prisma.SupplierWhereInput[] = [];

  const search = query.search?.trim();
  if (search) {
    const branches: Prisma.SupplierWhereInput[] = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { cnic: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
    ];
    const canonical = normalizePhone(search);
    if (canonical && canonical !== search) {
      branches.push({
        phone: { contains: canonical, mode: 'insensitive' },
      });
    }
    and.push({ OR: branches });
  }

  const phone = query.phone?.trim();
  if (phone) {
    const branches: Prisma.SupplierWhereInput[] = [
      { phone: { contains: phone, mode: 'insensitive' } },
    ];
    const canonical = normalizePhone(phone);
    if (canonical && canonical !== phone) {
      branches.push({
        phone: { contains: canonical, mode: 'insensitive' },
      });
    }
    and.push({ OR: branches });
  }

  const address = query.address?.trim();
  if (address) {
    and.push({ address: { contains: address, mode: 'insensitive' } });
  }

  const cnic = query.cnic?.trim();
  if (cnic) {
    and.push({ cnic: { contains: cnic, mode: 'insensitive' } });
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
