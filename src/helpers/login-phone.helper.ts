import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

type DbClient = PrismaService | Prisma.TransactionClient;

export type LoginPhoneConflict = 'USER' | 'PLATFORM_ADMIN';

/**
 * Login phones must be unique across the whole platform — a number cannot be
 * both a shop owner and a platform admin (or two owners).
 */
export async function findLoginPhoneConflict(
  client: DbClient,
  phone: string,
  options?: {
    excludeUserId?: string;
    excludePlatformAdminId?: string;
  },
): Promise<LoginPhoneConflict | null> {
  const [user, admin] = await Promise.all([
    client.user.findFirst({
      where: {
        phone,
        ...(options?.excludeUserId
          ? { id: { not: options.excludeUserId } }
          : {}),
      },
      select: { id: true },
    }),
    client.platformAdmin.findFirst({
      where: {
        phone,
        ...(options?.excludePlatformAdminId
          ? { id: { not: options.excludePlatformAdminId } }
          : {}),
      },
      select: { id: true },
    }),
  ]);

  if (user) return 'USER';
  if (admin) return 'PLATFORM_ADMIN';
  return null;
}
