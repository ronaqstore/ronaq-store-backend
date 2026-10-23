/**
 * Wipe every business table, keep platform_admins (super admin) + migrations.
 *
 * Local / intentional remote only:
 *   npm run db:clean
 *   npm run db:clean -- --force   # when DATABASE_URL is not localhost
 */
const net = require('net');
net.setDefaultAutoSelectFamily?.(false);

const path = require('path');
const dotenv = require('dotenv');

const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client.js');

const rawDbUrl = process.env.DATABASE_URL || '';
const cleanDbUrl = rawDbUrl
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: cleanDbUrl }),
});

const KEEP_TABLES = new Set(['platform_admins', '_prisma_migrations']);

function databaseLooksShared() {
  const url = process.env.DATABASE_URL || '';
  if (!url) return true;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

async function main() {
  const allowRemote =
    process.env.ALLOW_REMOTE_SEED === 'true' || process.argv.includes('--force');

  if (databaseLooksShared() && !allowRemote) {
    throw new Error(
      'Refusing to clean: DATABASE_URL does not point at localhost.\n' +
        'If you intend to wipe a live/remote database, set ALLOW_REMOTE_SEED=true or pass --force:\n' +
        '  ALLOW_REMOTE_SEED=true npm run db:clean\n' +
        '  or: npm run db:clean -- --force',
    );
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`,
  );

  const tables = rows
    .map((r) => r.tablename)
    .filter((name) => !KEEP_TABLES.has(name));

  if (tables.length === 0) {
    console.log('Nothing to wipe (only keep-tables present).');
    return;
  }

  const quoted = tables.map((t) => `"${t}"`).join(', ');
  console.log(`🧹 Truncating ${tables.length} table(s), keeping platform_admins…`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);

  const admins = await prisma.platformAdmin.findMany({
    select: { id: true, name: true, phone: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log('✅ Database cleaned.');
  console.log(`   Kept ${admins.length} platform admin(s):`);
  for (const a of admins) {
    console.log(`   - ${a.name} | ${a.phone} | active=${a.isActive} | ${a.id}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Clean failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
