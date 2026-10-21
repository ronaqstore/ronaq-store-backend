const net = require('net');
net.setDefaultAutoSelectFamily?.(false);

const path = require('path');
const dotenv = require('dotenv');

const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const bcrypt = require('bcrypt');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client.js');
const { normalizePhone } = require('../dist/helpers/phone.helper.js');
const { seedDemoData } = require('./seed-demo.cjs');

const BCRYPT_ROUNDS = 10;

const rawDbUrl = process.env.DATABASE_URL || '';
const cleanDbUrl = rawDbUrl
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: cleanDbUrl }),
});

const ADMIN_RAW_PHONE = process.env.SEED_ADMIN_PHONE || '03029825213';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin@123';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Super Admin';

async function seedPlatformAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD.trim(), BCRYPT_ROUNDS);

  const emailAdmin = await prisma.platformAdmin.upsert({
    where: { phone: 'super-admin@gmail.com' },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      isActive: true,
    },
    create: {
      name: ADMIN_NAME,
      phone: 'super-admin@gmail.com',
      passwordHash,
      isActive: true,
    },
  });

  const adminPhone = normalizePhone(ADMIN_RAW_PHONE.trim()) || '923029825213';
  const phoneAdmin = await prisma.platformAdmin.upsert({
    where: { phone: adminPhone },
    update: {
      name: ADMIN_NAME,
      passwordHash,
      isActive: true,
    },
    create: {
      name: ADMIN_NAME,
      phone: adminPhone,
      passwordHash,
      isActive: true,
    },
  });

  console.log('✅ Super Admin (Platform Admin) seeded successfully:');
  console.log(`   Email:    ${emailAdmin.phone} (Password: ${ADMIN_PASSWORD})`);
  console.log(
    `   Phone:    ${ADMIN_RAW_PHONE} (canonical: ${phoneAdmin.phone}, Password: ${ADMIN_PASSWORD})`,
  );
  console.log('');
  return emailAdmin;
}

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
      'Refusing to seed: DATABASE_URL does not point at localhost.\n' +
        'If you intend to seed a live/remote database, set ALLOW_REMOTE_SEED=true or pass --force:\n' +
        '  ALLOW_REMOTE_SEED=true npm run seed\n' +
        '  or: npm run seed -- --force',
    );
  }

  console.log('🌱 Starting database seed...');
  console.log('');

  await seedPlatformAdmin();

  const skipDemo = process.env.SEED_DEMO === 'false';
  if (!skipDemo) {
    await seedDemoData(prisma);
  } else {
    console.log('⏭️  SEED_DEMO=false — skipped shop demo data.');
  }

  console.log('');
  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('📋 Login Credentials Summary:');
  console.log('──────────────────────────────────────────────────');
  console.log('Super Admin (Platform Admin):');
  console.log('   Email:    super-admin@gmail.com');
  console.log(`   Phone:    ${ADMIN_RAW_PHONE} (or ${normalizePhone(ADMIN_RAW_PHONE)})`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log('   Endpoint: POST /auth/platform-admin/login');
  console.log('──────────────────────────────────────────────────');
  console.log('Shop Owner (shop #1):');
  console.log(`   Phone:    ${process.env.SEED_OWNER_PHONE || '03029825214'}`);
  console.log(`   Password: ${process.env.SEED_OWNER_PASSWORD || 'admin@123'}`);
  console.log('   Endpoint: POST /auth/login');
  console.log('──────────────────────────────────────────────────');
  console.log('Tip: wipe shops first with `npm run db:clean` if you need a full reseed.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Seeding failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
