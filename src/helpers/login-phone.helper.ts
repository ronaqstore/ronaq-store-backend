import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { FindLoginPhoneConflictOptions } from './login-phone.helper.types.js';

type DbClient = PrismaService | Prisma.TransactionClient;

export type LoginPhoneConflict = 'USER' | 'PLATFORM_ADMIN';

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

  return null;
}
