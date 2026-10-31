import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load appropriate .env based on NODE_ENV
const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '..', '.env.production')
  : path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting DB cleanup (preserving admin user)...');

  // 1. Preserve only the super admin (PlatformAdmin). Skip deletion of the PlatformAdmin table.
  // No user preservation – all user rows will be removed.
  // (PlatformAdmin records are retained automatically by skipping its table.)

  // 2. Delete all rows from all tables except the User table.
  // Fetch all table names in the public schema.
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  for (const { tablename } of tables) {
    const lower = tablename.toLowerCase();
    if (lower === 'user' || lower === 'users' || lower === 'platformadmin' || lower === '_prisma_migrations') {
      continue;
    }
    // Use raw DELETE to bypass Prisma's cascade restrictions.
    await prisma.$executeRawUnsafe(`DELETE FROM "${tablename}"`);
    console.log(`✅ Deleted all rows from ${tablename}`);
  }

  // 3. Delete all shop users (PlatformAdmin table is preserved).
  await prisma.user.deleteMany();
  console.log('✅ Deleted all users');

  console.log('✨ DB cleanup complete.');
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

