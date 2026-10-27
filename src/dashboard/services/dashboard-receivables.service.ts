import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RecordStatus } from '../../generated/prisma/enums.js';
import {
  agingBucketForDays,
  computeOverdueDays,
} from '../helpers/dashboard-aging.helper.js';
import { DashboardCacheService } from './dashboard-cache.service.js';
import {
  AgingBucketDto,
  ReceivablesAgingResponseDto,
  TopDebtorDto,
} from '../dto/shop/receivables-aging.dto.js';
import { businessToday } from '../../helpers/date.helper.js';

const ACTIVE = RecordStatus.ACTIVE;
const TOP_DEBTORS = 5;

@Injectable()
export class DashboardReceivablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DashboardCacheService,
  ) {}

  async getReceivablesAging(
    shopId: string,
  ): Promise<ReceivablesAgingResponseDto> {
    const cacheKey = `shop:${shopId}:aging`;
    const cached = this.cache.get<ReceivablesAgingResponseDto>(cacheKey);
    if (cached) return cached;

    const today = businessToday();

    const balanceRows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        phone: string | null;
        opening_balance: bigint;
        balance: bigint;
      }>
    >(Prisma.sql`
      WITH balances AS (
        SELECT c.id, c.name, c.phone, c.opening_balance,
               (
                 c.opening_balance
                 + COALESCE((
                     SELECT SUM(s.total_amount) FROM sales s
                     WHERE s.customer_id = c.id AND s.status = 'ACTIVE'
                   ), 0)
                 - COALESCE((
                     SELECT SUM(p.amount) FROM payments p
                     WHERE p.customer_id = c.id AND p.status = 'ACTIVE'
                   ), 0)
                 - COALESCE((
                     SELECT SUM(r.return_amount) FROM returns r
                     WHERE r.customer_id = c.id AND r.status = 'ACTIVE'
                   ), 0)
                 + COALESCE((
                     SELECT SUM(f.amount) FROM refunds f
                     INNER JOIN returns r ON r.id = f.return_id
                     WHERE r.customer_id = c.id AND r.status = 'ACTIVE'
                   ), 0)
               )::bigint AS balance
        FROM customers c
        WHERE c.shop_id = ${shopId}::uuid
          AND c.is_active = true
      )
      SELECT id, name, phone, opening_balance, balance
      FROM balances
      WHERE balance > 0
    `);

    const debtorIds = balanceRows.map((r) => r.id);
    const customers =
      debtorIds.length === 0
        ? []
        : await this.prisma.customer.findMany({
            where: { shopId, id: { in: debtorIds } },
            select: {
              id: true,
              name: true,
              phone: true,
              openingBalance: true,
              sales: {
                where: { status: ACTIVE },
                select: {
                  totalAmount: true,
                  saleDate: true,
                  dueDate: true,
                  payments: {
                    where: { status: ACTIVE },
                    select: { amount: true },
                  },
                  saleReturns: {
                    where: { status: ACTIVE },
                    select: {
                      returnAmount: true,
                      refunds: { select: { amount: true } },
                    },
                  },
                },
              },
            },
          });

    const balanceById = new Map(
      balanceRows.map((r) => [
        r.id,
        {
          name: r.name,
          phone: r.phone,
          opening: Number(r.opening_balance),
          balance: Number(r.balance),
        },
      ]),
    );

    const bucketsConfig = [
      { key: '0-7', label: '0–7 days', min: 0, max: 7 },
      { key: '8-30', label: '8–30 days', min: 8, max: 30 },
      { key: '31-60', label: '31–60 days', min: 31, max: 60 },
      { key: '60+', label: '60+ days', min: 61, max: Infinity },
    ];

    const bucketAmounts = new Map<string, number>();
    const bucketCustomers = new Map<string, Set<string>>();
    for (const b of bucketsConfig) {
      bucketAmounts.set(b.key, 0);
      bucketCustomers.set(b.key, new Set<string>());
    }

    let totalUdhar = 0;
    const debtors: TopDebtorDto[] = [];

    for (const c of customers) {
      const meta = balanceById.get(c.id);
      if (!meta) continue;
      const opening = meta.opening;
      const balance = meta.balance;
      let customerMaxDays = 0;
      const salesList: Array<{ amount: number; days: number }> = [];

      for (const s of c.sales) {
        const saleTotal = Number(s.totalAmount);
        const salePaid = s.payments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const saleReturns = s.saleReturns.reduce(
          (sum, r) => sum + Number(r.returnAmount),
          0,
        );
        const saleRefunds = s.saleReturns.reduce(
          (sum, r) => sum + r.refunds.reduce((x, f) => x + Number(f.amount), 0),
          0,
        );
        const saleUnpaid = saleTotal - saleReturns + saleRefunds - salePaid;
        if (saleUnpaid > 0) {
          const days = computeOverdueDays(
            today,
            s.saleDate.toISOString(),
            s.dueDate?.toISOString() ?? null,
          );
          salesList.push({ amount: saleUnpaid, days });
          if (days > customerMaxDays) customerMaxDays = days;
        }
      }

      if (balance > 0) {
        totalUdhar += balance;
        if (opening > 0 && customerMaxDays < 61) {
          customerMaxDays = 61;
        }
        debtors.push({
          customerId: c.id,
          name: meta.name,
          phone: meta.phone,
          amount: balance,
          oldestDays: customerMaxDays,
        });

        let remaining = balance;
        if (opening > 0) {
          const alloc = Math.min(remaining, opening);
          bucketAmounts.set('60+', (bucketAmounts.get('60+') ?? 0) + alloc);
          bucketCustomers.get('60+')?.add(c.id);
          remaining -= alloc;
        }

        salesList.sort((a, b) => b.days - a.days);
        for (const item of salesList) {
          if (remaining <= 0) break;
          const alloc = Math.min(remaining, item.amount);
          const bKey = agingBucketForDays(item.days);
          bucketAmounts.set(bKey, (bucketAmounts.get(bKey) ?? 0) + alloc);
          bucketCustomers.get(bKey)?.add(c.id);
          remaining -= alloc;
        }

        if (remaining > 0) {
          bucketAmounts.set('0-7', (bucketAmounts.get('0-7') ?? 0) + remaining);
          bucketCustomers.get('0-7')?.add(c.id);
        }
      }
    }

    debtors.sort((a, b) => b.amount - a.amount);
    const topDebtors = debtors.slice(0, TOP_DEBTORS);

    const buckets: AgingBucketDto[] = bucketsConfig.map((b) => ({
      bucket: b.key,
      label: b.label,
      amount: bucketAmounts.get(b.key) ?? 0,
      customerCount: bucketCustomers.get(b.key)?.size ?? 0,
    }));

    const result: ReceivablesAgingResponseDto = {
      totalUdhar,
      buckets,
      topDebtors,
    };

    this.cache.set(cacheKey, result, 60);
    return result;
  }
}
