import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import dotenv from 'dotenv';
import path from 'path';

// Load appropriate .env based on NODE_ENV
const envPath =
  process.env.NODE_ENV === 'production'
    ? path.resolve(__dirname, '..', '.env.production')
    : path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const connectionString =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log('🔧 Starting DB cleanup (preserving platform super admins)...');

  // Fetch all table names in the public schema.
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  // Tables that should NEVER be wiped during normal reset:
  const preservedTables = new Set([
    'platform_admins',
    'platformadmin',
    '_prisma_migrations',
  ]);

  for (const { tablename } of tables) {
    const lower = tablename.toLowerCase();
    if (preservedTables.has(lower) || lower === 'users' || lower === 'user') {
      continue;
    }
    // Delete non-user tenant rows
    await prisma.$executeRawUnsafe(`DELETE FROM "${tablename}"`);
    console.log(`✅ Deleted all rows from ${tablename}`);
  }

  // Delete all shop users (PlatformAdmin table is preserved)
  await prisma.user.deleteMany();
  console.log('✅ Deleted all users');

  const adminCount = await prisma.platformAdmin.count();
  console.log(`✨ DB cleanup complete. Preserved ${adminCount} platform super admin(s).`);
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
