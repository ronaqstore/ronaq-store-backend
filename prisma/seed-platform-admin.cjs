/**
 * Creates (or resets) the local platform admins so you can log into the platform dashboard / Swagger.
 *
 * Platform admins cannot sign themselves up — an unauthenticated POST would let
 * anyone on the internet mint an HQ account. So platform admins are inserted out-of-band.
 *
 * Local development only. Never point this at a shared or production database.
 *
 *   npm run seed:admin
 *
 * Reads SEED_ADMIN_1_* and SEED_ADMIN_2_* (or SEED_ADMIN_*) from the environment.
 * Default super admins:
 *   1. 03115514151 / admin@123
 *   2. 03059596704 / admin@123
 */
const net = require('net');
net.setDefaultAutoSelectFamily?.(false);

const path = require('path');
const dotenv = require('dotenv');

// Load environment files so DATABASE_URL and SEED_ADMIN_* are available
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const bcrypt = require('bcrypt');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client.js');
const { normalizePhone } = require('../dist/helpers/phone.helper.js');

const BCRYPT_ROUNDS = 10;

// Same pg adapter PrismaService uses. Prisma 7 requires one; it does not read
// DATABASE_URL by itself.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const adminsToSeed = [
  {
    rawPhone: (process.env.SEED_ADMIN_1_PHONE || process.env.SEED_ADMIN_PHONE || '03115514151').trim(),
    name: (process.env.SEED_ADMIN_1_NAME || 'Super Admin 1').trim(),
    password: (process.env.SEED_ADMIN_1_PASSWORD || process.env.SEED_ADMIN_PASSWORD || 'admin@123').trim(),
  },
  {
    rawPhone: (process.env.SEED_ADMIN_2_PHONE || '03059596704').trim(),
    name: (process.env.SEED_ADMIN_2_NAME || 'Super Admin 2').trim(),
    password: (process.env.SEED_ADMIN_2_PASSWORD || 'admin@123').trim(),
  },
];

/**
 * A weak guard against `npm run seed:admin` aimed at the wrong database.
 */
function databaseLooksShared() {
  const url = process.env.DATABASE_URL || '';
  if (!url) return true;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

async function main() {
  const allowRemote =
    process.env.ALLOW_REMOTE_SEED === 'true' ||
    process.argv.includes('--force');

  if (databaseLooksShared() && !allowRemote) {
    throw new Error(
      'Refusing to seed: DATABASE_URL does not point at localhost.\n' +
        'If you intend to seed a live/remote database, set ALLOW_REMOTE_SEED=true or pass --force:\n' +
        '  ALLOW_REMOTE_SEED=true npm run seed:admin\n' +
        '  or: npm run seed:admin -- --force',
    );
  }

  const seededPhones = [];

  for (const item of adminsToSeed) {
    const phone = normalizePhone(item.rawPhone);
    if (!phone) {
      throw new Error(
        `SEED_ADMIN_PHONE "${item.rawPhone}" is not a valid Pakistani mobile number.`,
      );
    }

    // Login phones are unique across the whole platform (users + platform_admins).
    const existingOwner = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, name: true },
    });
    if (existingOwner) {
      throw new Error(
        `Phone ${phone} is already used by a shop owner (user id ${existingOwner.id}, name "${existingOwner.name}").\n` +
          'Pick a different SEED_ADMIN_PHONE — the same mobile cannot be both a platform admin and a shop owner.',
      );
    }

    const passwordHash = await bcrypt.hash(item.password, BCRYPT_ROUNDS);

    const admin = await prisma.platformAdmin.upsert({
      where: { phone },
      update: { name: item.name, passwordHash, isActive: true },
      create: { name: item.name, phone, passwordHash, isActive: true },
    });

    seededPhones.push(phone);

    console.log('Platform admin ready.');
    console.log(`  id:    ${admin.id}`);
    console.log(`  name:  ${admin.name}`);
    console.log(`  phone: ${admin.phone} (${item.rawPhone})`);
    console.log(`  pass:  ${item.password}`);
    console.log('');
  }

  // Remove any obsolete platform admins that are public support contacts (e.g. 923029825213)
  const obsoleteAdmins = await prisma.platformAdmin.deleteMany({
    where: {
      phone: { notIn: seededPhones },
    },
  });
  if (obsoleteAdmins.count > 0) {
    console.log(`Cleaned up ${obsoleteAdmins.count} non-super-admin record(s) from platform_admins.`);
  }

  console.log('Log in at /platform-admin/login or POST /auth/platform-admin/login');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
