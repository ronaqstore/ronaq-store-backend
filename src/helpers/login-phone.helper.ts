import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { FindLoginPhoneConflictOptions } from './login-phone.helper.types.js';

type DbClient = PrismaService | Prisma.TransactionClient;

export type LoginPhoneConflict =
  'USER' | 'PLATFORM_ADMIN' | 'SUPPLIER' | 'CUSTOMER';

export async function findLoginPhoneConflict(
  client: DbClient,
  phone: string,
  options?: FindLoginPhoneConflictOptions,
): Promise<LoginPhoneConflict | null> {
  const user = await client.user.findFirst({
    where: {
      phone,
      ...(options?.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (user) return 'USER';

  const admin = await client.platformAdmin.findFirst({
    where: {
      phone,
      ...(options?.excludePlatformAdminId
        ? { id: { not: options.excludePlatformAdminId } }
        : {}),
    },
    select: { id: true },
  });
  if (admin) return 'PLATFORM_ADMIN';

  const supplier = await client.supplier.findFirst({
    where: {
      phone,
      ...(options?.excludeSupplierId
        ? { id: { not: options.excludeSupplierId } }
        : {}),
    },
    select: { id: true },
  });
  if (supplier) return 'SUPPLIER';

  const customer = await client.customer.findFirst({
    where: {
      phone,
      ...(options?.excludeCustomerId
        ? { id: { not: options.excludeCustomerId } }
        : {}),
    },
    select: { id: true },
  });
  if (customer) return 'CUSTOMER';

  return null;
}
