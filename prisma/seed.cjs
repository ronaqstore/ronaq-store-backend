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
const { normalizePhone, normalizePhoneOrRaw } = require('../dist/helpers/phone.helper.js');
const {
  DEFAULT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  WALK_IN_SUPPLIER,
} = require('../dist/platform-admin/constants/default-lists.constant.js');
const {
  storeSlugBase,
  nextFreeStoreSlug,
} = require('../dist/store/helpers/store-slug.helper.js');

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

const OWNER_RAW_PHONE = process.env.SEED_OWNER_PHONE || '03115514151';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || 'admin@123';
const OWNER_NAME = process.env.SEED_OWNER_NAME || 'Shop Owner';
const SHOP_NAME = process.env.SEED_SHOP_NAME || 'Ronaq Store';

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
  console.log(`   Phone:    03029825213 (canonical: ${phoneAdmin.phone}, Password: ${ADMIN_PASSWORD})`);
  console.log('');
  return emailAdmin;
}

async function seedShopAndOwner() {
  const ownerPhone = normalizePhone(OWNER_RAW_PHONE.trim());
  if (!ownerPhone) {
    throw new Error(`Invalid owner phone number: "${OWNER_RAW_PHONE}"`);
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD.trim(), BCRYPT_ROUNDS);
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const existingUser = await prisma.user.findUnique({
    where: { phone: ownerPhone },
    include: { shop: true },
  });

  let shop;
  let owner;

  if (existingUser) {
    owner = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: OWNER_NAME,
        passwordHash,
        status: 'ACTIVE',
        role: 'OWNER',
      },
    });

    shop = await prisma.shop.update({
      where: { id: existingUser.shopId },
      data: {
        name: SHOP_NAME,
        status: 'ACTIVE',
        subscriptionEndsAt: oneYearFromNow,
      },
    });

    console.log('✅ Shop & Owner updated successfully:');
  } else {
    const result = await prisma.$transaction(async (tx) => {
      const createdShop = await tx.shop.create({
        data: {
          name: SHOP_NAME,
          phone: normalizePhoneOrRaw(OWNER_RAW_PHONE),
          address: 'Main Market, Pakistan',
          status: 'ACTIVE',
          subscriptionEndsAt: oneYearFromNow,
        },
      });

      const createdOwner = await tx.user.create({
        data: {
          shopId: createdShop.id,
          name: OWNER_NAME,
          phone: ownerPhone,
          passwordHash,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      if (DEFAULT_CATEGORIES && DEFAULT_CATEGORIES.length > 0) {
        await tx.category.createMany({
          data: DEFAULT_CATEGORIES.map((catName) => ({
            shopId: createdShop.id,
            name: catName,
          })),
        });
      }

      if (DEFAULT_EXPENSE_CATEGORIES && DEFAULT_EXPENSE_CATEGORIES.length > 0) {
        await tx.expenseCategory.createMany({
          data: DEFAULT_EXPENSE_CATEGORIES.map((expName) => ({
            shopId: createdShop.id,
            name: expName,
          })),
        });
      }

      if (WALK_IN_SUPPLIER) {
        await tx.supplier.create({
          data: {
            shopId: createdShop.id,
            name: WALK_IN_SUPPLIER.name,
            notes: WALK_IN_SUPPLIER.notes,
            isSystem: WALK_IN_SUPPLIER.isSystem,
          },
        });
      }

      const storeSlug = await nextFreeStoreSlug(
        storeSlugBase(createdShop.name, createdShop.id),
        async (candidate) =>
          Boolean(
            await tx.shopStoreSettings.findUnique({
              where: { slug: candidate },
              select: { slug: true },
            }),
          ),
      );

      await tx.shopStoreSettings.create({
        data: {
          shopId: createdShop.id,
          slug: storeSlug,
          isEnabled: false,
          displayName: createdShop.name.trim().slice(0, 100),
          phoneNumber: createdShop.phone,
          address: createdShop.address,
        },
      });

      return { shop: createdShop, owner: createdOwner };
    }, { timeout: 30000, maxWait: 10000 });

    shop = result.shop;
    owner = result.owner;
    console.log('✅ Shop & Owner created successfully:');
  }

  console.log(`   Shop ID:   ${shop.id}`);
  console.log(`   Shop Name: ${shop.name}`);
  console.log(`   Owner ID:  ${owner.id}`);
  console.log(`   Name:      ${owner.name}`);
  console.log(`   Phone:     ${owner.phone} (${OWNER_RAW_PHONE})`);
  console.log(`   Password:  ${OWNER_PASSWORD}`);
  console.log(`   Role:      ${owner.role}`);
  console.log('');
  return { shop, owner };
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
        '  or: npm run seed -- --force'
    );
  }

  console.log('🌱 Starting database seed...');
  console.log('');

  await seedPlatformAdmin();
  if (process.env.SEED_SHOP === 'true') {
    await seedShopAndOwner();
  }

  console.log('🎉 Seeding complete!');
  console.log('');
  console.log('📋 Login Credentials Summary:');
  console.log('──────────────────────────────────────────────────');
  console.log('Super Admin (Platform Admin):');
  console.log('   Email:    super-admin@gmail.com');
  console.log(`   Phone:    03029825213 (or ${normalizePhone(ADMIN_RAW_PHONE)})`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log('   Endpoint: POST /auth/platform-admin/login');
  console.log('──────────────────────────────────────────────────');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Seeding failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
