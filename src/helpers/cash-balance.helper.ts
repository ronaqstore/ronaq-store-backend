import { CashDirection } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

type CashMovementReader = Pick<Prisma.TransactionClient, 'cashMovement'>;

export type CashOverdraftProbe =
  { kind: 'ok'; overdraft: boolean } | { kind: 'overdraft'; shortfall: number };

export async function probeCashOverdraft(
  db: CashMovementReader,
  shopId: string,
  amount: bigint,
  confirmOverdraft: boolean | undefined,
): Promise<CashOverdraftProbe> {
  const after = (await aggregateCurrentCash(db, shopId)) - Number(amount);
  if (after < 0) {
    if (!confirmOverdraft) {
      return { kind: 'overdraft', shortfall: -after };
    }
    return { kind: 'ok', overdraft: true };
  }
  return { kind: 'ok', overdraft: false };
}

export async function aggregateCurrentCash(
  db: CashMovementReader,
  shopId: string,
): Promise<number> {
  const inbound = await db.cashMovement.aggregate({
    where: { shopId, direction: CashDirection.IN },
    _sum: { amount: true },
  });
  const outbound = await db.cashMovement.aggregate({
    where: { shopId, direction: CashDirection.OUT },
    _sum: { amount: true },
  });
  return Number(inbound._sum.amount ?? 0) - Number(outbound._sum.amount ?? 0);
}
