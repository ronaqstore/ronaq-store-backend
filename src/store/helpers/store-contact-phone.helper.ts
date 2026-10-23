import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  invalidOwnerPhone,
  storeContactPhoneTaken,
} from '../../errors/error.builder.js';
import { normalizePhone, toLocalPkPhone } from '../../helpers/phone.helper.js';

export async function normalizeAndAssertContactPhone(
  prisma: PrismaService,
  raw: string | null | undefined,
  shopId: string,
): Promise<string | null> {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const e164 = normalizePhone(trimmed);
  if (!e164) {
    throw new BadRequestException(invalidOwnerPhone(trimmed));
  }
  const local = toLocalPkPhone(e164);
  if (!local) {
    throw new BadRequestException(invalidOwnerPhone(trimmed));
  }
  const phoneOr = [{ phone: e164 }, { phone: local }];

  const ownUser = await prisma.user.findFirst({
    where: { shopId, OR: phoneOr },
    select: { id: true },
  });
  if (ownUser) {
    return local;
  }

  const admin = await prisma.platformAdmin.findFirst({
    where: { OR: phoneOr },
    select: { id: true },
  });
  if (admin) {
    throw new BadRequestException(storeContactPhoneTaken(local));
  }

  const otherOwner = await prisma.user.findFirst({
    where: { shopId: { not: shopId }, OR: phoneOr },
    select: { id: true },
  });
  if (otherOwner) {
    throw new BadRequestException(storeContactPhoneTaken(local));
  }

  return local;
}
