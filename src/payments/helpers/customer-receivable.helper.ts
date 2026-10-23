import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RecordStatus } from '../../generated/prisma/enums.js';
import {
  CustomerReceivableDto,
  UnpaidSaleDto,
} from '../dto/response-customer-receivable.dto.js';
import { resourceNotFound } from '../../errors/error.builder.js';

export async function getCustomerReceivable(
  prisma: PrismaService,
  customerId: string,
  shopId: string,
): Promise<CustomerReceivableDto> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, shopId },
    select: { id: true, name: true, openingBalance: true },
  });
  if (!customer) {
    throw new NotFoundException(resourceNotFound('Customer', customerId));
  }

  const [sales, payments, returns, refundRows] = await Promise.all([
    prisma.sale.findMany({
      where: {
        shopId,
        customerId,
        status: RecordStatus.ACTIVE,
      },
      orderBy: [{ saleDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        saleNo: true,
        saleDate: true,
        totalAmount: true,
      },
    }),
    prisma.payment.findMany({
      where: { shopId, customerId, status: RecordStatus.ACTIVE },
      select: { saleId: true, amount: true },
    }),
    prisma.saleReturn.groupBy({
      by: ['saleId'],
      where: {
        shopId,
        customerId,
        status: RecordStatus.ACTIVE,
      },
      _sum: { returnAmount: true },
    }),
    prisma.refund.findMany({
      where: {
        shopId,
        saleReturn: {
          customerId,
          status: RecordStatus.ACTIVE,
        },
      },
      select: {
        amount: true,
        saleReturn: { select: { saleId: true } },
      },
    }),
  ]);

  let totalSales = 0n;
  let totalPaid = 0n;
  let paidOnOpening = 0n;
  const paidBySale = new Map<string, bigint>();
  for (const sale of sales) totalSales += sale.totalAmount;
  for (const pay of payments) {
    totalPaid += pay.amount;
    if (pay.saleId === null) paidOnOpening += pay.amount;
    else {
      paidBySale.set(
        pay.saleId,
        (paidBySale.get(pay.saleId) ?? 0n) + pay.amount,
      );
    }
  }

  const returnedBySale = new Map<string, bigint>();
  for (const row of returns) {
    returnedBySale.set(row.saleId, row._sum.returnAmount ?? 0n);
  }
  const refundedBySale = new Map<string, bigint>();
  let totalRefunds = 0n;
  for (const row of refundRows) {
    totalRefunds += row.amount;
    const saleId = row.saleReturn.saleId;
    refundedBySale.set(saleId, (refundedBySale.get(saleId) ?? 0n) + row.amount);
  }

  let totalReturns = 0n;
  for (const amount of returnedBySale.values()) totalReturns += amount;

  const openingRemainingRaw = customer.openingBalance - paidOnOpening;
  const openingRemaining = openingRemainingRaw > 0n ? openingRemainingRaw : 0n;

  const unpaidSales: UnpaidSaleDto[] = sales
    .map((sale) => {
      const paidAmount = paidBySale.get(sale.id) ?? 0n;
      const remainingRaw =
        sale.totalAmount -
        (returnedBySale.get(sale.id) ?? 0n) -
        paidAmount +
        (refundedBySale.get(sale.id) ?? 0n);
      const remaining = remainingRaw > 0n ? remainingRaw : 0n;
      return {
        id: sale.id,
        saleNo: sale.saleNo,
        saleDate:
          sale.saleDate instanceof Date
            ? sale.saleDate.toISOString().slice(0, 10)
            : String(sale.saleDate).slice(0, 10),
        totalAmount: Number(sale.totalAmount),
        paidAmount: Number(paidAmount),
        remaining: Number(remaining),
      };
    })
    .filter((sale) => sale.remaining > 0);

  const receivable =
    customer.openingBalance +
    totalSales -
    totalPaid -
    totalReturns +
    totalRefunds;

  return {
    customerId: customer.id,
    customerName: customer.name,
    openingBalance: Number(customer.openingBalance),
    openingRemaining: Number(openingRemaining),
    totalSales: Number(totalSales),
    totalPaid: Number(totalPaid),
    receivable: Number(receivable > 0n ? receivable : 0n),
    unpaidSales,
  };
}
