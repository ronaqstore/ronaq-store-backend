import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { UnitStatus } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { duplicateImei } from '../errors/error.builder.js';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Searches for an existing IN_STOCK inventory unit in the given shop that matches
 * either imei1 or imei2, excluding the specified unit ID.
 */
export async function findConflictingInStockUnit(
  db: Db,
  shopId: string,
  excludeUnitId: string,
  imei1: string,
  imei2?: string | null,
): Promise<{ id: string; imei1: string; imei2: string | null } | null> {
  const orConditions: Prisma.InventoryUnitWhereInput[] = [
    { imei1 },
    { imei2: imei1 },
  ];
  if (imei2) {
    orConditions.push({ imei1: imei2 });
    orConditions.push({ imei2 });
  }

  return db.inventoryUnit.findFirst({
    where: {
      shopId,
      id: { not: excludeUnitId },
      status: UnitStatus.IN_STOCK,
      OR: orConditions,
    },
    select: { id: true, imei1: true, imei2: true },
  });
}

/**
 * Asserts that neither imei1 nor imei2 belongs to any active IN_STOCK inventory unit
 * in the same shop (other than the unit being restored).
 * If a conflict is found, throws a BadRequestException.
 */
export async function assertImeiNotInStock(
  db: Db,
  shopId: string,
  excludeUnitId: string,
  imei1: string,
  imei2?: string | null,
  errorFactory?: (conflictingImei: string) => BadRequestException,
): Promise<void> {
  const hit = await findConflictingInStockUnit(
    db,
    shopId,
    excludeUnitId,
    imei1,
    imei2,
  );
  if (hit) {
    const matchedImei =
      hit.imei1 === imei1 || hit.imei2 === imei1
        ? imei1
        : (imei2 ?? imei1);
    if (errorFactory) {
      throw errorFactory(matchedImei);
    }
    throw new BadRequestException(duplicateImei(matchedImei));
  }
}

