import { Prisma } from '../../generated/prisma/client.js';

export function buildAmountRangeFilter(
  minAmount?: number,
  maxAmount?: number,
): Prisma.BigIntFilter | undefined {
  if (minAmount === undefined && maxAmount === undefined) {
    return undefined;
  }
  const amount: Prisma.BigIntFilter = {};
  if (minAmount !== undefined) amount.gte = BigInt(minAmount);
  if (maxAmount !== undefined) amount.lte = BigInt(maxAmount);
  return amount;
}
