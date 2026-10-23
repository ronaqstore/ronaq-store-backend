import type { PrismaClient } from '../generated/prisma/client.js';
import { RecordStatus } from '../generated/prisma/enums.js';

type PrismaLike = Pick<
  PrismaClient,
  'sale' | 'payment' | 'saleReturn' | 'refund' | 'purchase' | 'supplierPayment'
>;

export async function customerCurrentBalances(
  prisma: PrismaLike,
  shopId: string,
  customerIds: string[],
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  if (customerIds.length === 0) return balances;

  const [sales, payments, returns, refundRows] = await Promise.all([
    prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        shopId,
        customerId: { in: customerIds },
        status: RecordStatus.ACTIVE,
      },
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ['customerId'],
      where: {
        shopId,
        customerId: { in: customerIds },
        status: RecordStatus.ACTIVE,
      },
      _sum: { amount: true },
    }),
    prisma.saleReturn.groupBy({
      by: ['customerId'],
      where: {
        shopId,
        customerId: { in: customerIds },
        status: RecordStatus.ACTIVE,
      },
      _sum: { returnAmount: true },
    }),
    prisma.refund.findMany({
      where: {
        shopId,
        saleReturn: {
          customerId: { in: customerIds },
          status: RecordStatus.ACTIVE,
        },
      },
      select: {
        amount: true,
        saleReturn: { select: { customerId: true } },
      },
    }),
  ]);

  const salesMap = new Map(
    sales
      .filter((row) => row.customerId != null)
      .map((row) => [
        row.customerId as string,
        Number(row._sum.totalAmount ?? 0n),
      ]),
  );
  const paymentsMap = new Map(
    payments
      .filter((row) => row.customerId != null)
      .map((row) => [row.customerId as string, Number(row._sum.amount ?? 0n)]),
  );
  const returnsMap = new Map(
    returns
      .filter((row) => row.customerId != null)
      .map((row) => [
        row.customerId as string,
        Number(row._sum.returnAmount ?? 0n),
      ]),
  );
  const refundsMap = new Map<string, number>();
  for (const row of refundRows) {
    const customerId = row.saleReturn.customerId;
    if (!customerId) continue;
    refundsMap.set(
      customerId,
      (refundsMap.get(customerId) ?? 0) + Number(row.amount),
    );
  }

  for (const id of customerIds) {
    balances.set(
      id,
      (salesMap.get(id) ?? 0) -
        (paymentsMap.get(id) ?? 0) -
        (returnsMap.get(id) ?? 0) +
        (refundsMap.get(id) ?? 0),
    );
  }

  return balances;
}

export async function supplierCurrentBalances(
  prisma: PrismaLike,
  shopId: string,
  supplierIds: string[],
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  if (supplierIds.length === 0) return balances;

  const [purchases, payments] = await Promise.all([
    prisma.purchase.groupBy({
      by: ['supplierId'],
      where: {
        shopId,
        supplierId: { in: supplierIds },
        status: RecordStatus.ACTIVE,
        isOpeningStock: false,
      },
      _sum: { totalAmount: true },
    }),
    prisma.supplierPayment.groupBy({
      by: ['supplierId'],
      where: {
        shopId,
        supplierId: { in: supplierIds },
        status: RecordStatus.ACTIVE,
      },
      _sum: { amount: true },
    }),
  ]);

  const purchasesMap = new Map(
    purchases.map((row) => [
      row.supplierId,
      Number(row._sum.totalAmount ?? 0n),
    ]),
  );
  const paymentsMap = new Map(
    payments.map((row) => [row.supplierId, Number(row._sum.amount ?? 0n)]),
  );

  for (const id of supplierIds) {
    balances.set(id, (purchasesMap.get(id) ?? 0) - (paymentsMap.get(id) ?? 0));
  }

  return balances;
}
