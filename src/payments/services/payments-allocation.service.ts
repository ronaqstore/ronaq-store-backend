import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { resourceNotFound } from '../../errors/error.builder.js';

type Tx = Prisma.TransactionClient;

export type PaymentCandidateSale = { id: string; totalAmount: bigint };

@Injectable()
export class PaymentsAllocationService {
  async lockOpenSales(
    tx: Tx,
    shopId: string,
    customerId: string,
  ): Promise<PaymentCandidateSale[]> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; total_amount: bigint | string }>
    >`
      SELECT id, total_amount FROM sales
      WHERE shop_id = ${shopId} AND customer_id = ${customerId}
        AND status = 'ACTIVE'
      ORDER BY sale_date, id
      FOR UPDATE
    `;
    return (rows ?? []).map((row) => ({
      id: row.id,
      totalAmount: BigInt(row.total_amount),
    }));
  }

  async lockExplicitSales(
    tx: Tx,
    ids: string[],
    shopId: string,
    customerId: string,
  ): Promise<PaymentCandidateSale[]> {
    const ordered = await tx.sale.findMany({
      where: { id: { in: ids }, shopId, customerId, status: 'ACTIVE' },
      orderBy: [{ saleDate: 'asc' }, { id: 'asc' }],
      select: { id: true, totalAmount: true },
    });
    if (ordered.length !== ids.length) {
      const found = new Set(ordered.map((sale) => sale.id));
      const missing = ids.find((id) => !found.has(id));
      if (missing) {
        throw new NotFoundException(resourceNotFound('Sale', missing));
      }
    }
    for (const sale of ordered) {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM sales
        WHERE id = ${sale.id} AND shop_id = ${shopId} AND status = 'ACTIVE'
        FOR UPDATE
      `;
      if (!locked?.length) {
        throw new NotFoundException(resourceNotFound('Sale', sale.id));
      }
    }
    return ordered.map((sale) => ({
      id: sale.id,
      totalAmount: sale.totalAmount,
    }));
  }
}
