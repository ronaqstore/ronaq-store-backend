/**
 * Dev-only heavy analytics seed — multi-shop, mixed chart data.
 *
 *   APP_ENV=dev npm run seed:demo-analytics
 *
 * Env:
 *   SEED_DEMO_SHOP_NAME — single shop (default none when limit set)
 *   SEED_DEMO_SHOP_LIMIT — how many shops to seed (default 8)
 *   SEED_DEMO_MAX_SALES — sales per shop (default 420, max 600)
 *   ALLOW_REMOTE_SEED=true — allow non-localhost DB
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

dotenv.config({
  path: path.resolve(root, `.env.${process.env.NODE_ENV || 'development'}`),
});
dotenv.config({ path: path.resolve(root, '.env') });

if ((process.env.APP_ENV ?? '') !== 'dev') {
  console.error(
    'Refusing to run seed:demo-analytics. Set APP_ENV=dev for local use only.',
  );
  process.exit(1);
}

function databaseLooksShared() {
  const url = process.env.DATABASE_URL || '';
  if (!url) return true;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

function shiftDays(isoDate, delta) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function businessTodayKarachi() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function imeiPair(shopIdx, n) {
  const base = 860000000000000 + shopIdx * 1_000_000 + n * 10;
  return { imei1: String(base), imei2: String(base + 1) };
}

async function seedOneShop(ctx, shop, shopIdx, today, maxSales) {
  const {
    prisma,
    salesService,
    expensesService,
    paymentsService,
    customersService,
    purchasesService,
    returnsService,
    supplierPaymentsService,
    TrackingType,
  } = ctx;

  const owner = await prisma.user.findFirst({
    where: { shopId: shop.id, role: 'OWNER' },
    select: { id: true },
  });
  if (!owner) {
    console.warn(`skip ${shop.name}: no OWNER`);
    return null;
  }

  const shopId = shop.id;
  const userId = owner.id;

  const qtyProducts = await prisma.product.findMany({
    where: { shopId, isActive: true, trackingType: TrackingType.QUANTITY },
    select: { id: true, name: true, categoryId: true },
    take: 12,
  });
  const phoneProducts = await prisma.product.findMany({
    where: { shopId, isActive: true, trackingType: TrackingType.SERIALIZED },
    select: { id: true, name: true },
    take: 4,
  });
  const supplier = await prisma.supplier.findFirst({
    where: { shopId, isActive: true },
    select: { id: true },
  });
  const expenseCats = await prisma.expenseCategory.findMany({
    where: { shopId, isActive: true },
    select: { id: true },
  });

  if (!supplier || qtyProducts.length === 0) {
    console.warn(`skip ${shop.name}: need supplier + QUANTITY products`);
    return null;
  }

  const stockPerProduct = Math.ceil((maxSales + 80) / qtyProducts.length);
  for (const p of qtyProducts) {
    await purchasesService.createPurchase(
      {
        clientRequestId: randomUUID(),
        supplierId: supplier.id,
        purchaseDate: shiftDays(today, -85 - (shopIdx % 5)),
        isOpeningStock: true,
        paidNow: 0,
        items: [
          {
            productId: p.id,
            quantity: stockPerProduct,
            unitCost: 45000 + shopIdx * 1000,
          },
        ],
        notes: 'seed:demo-analytics stock',
      },
      shopId,
      userId,
    );
  }

  // Unpaid purchase for payables / supplier payment charts
  await purchasesService.createPurchase(
    {
      clientRequestId: randomUUID(),
      supplierId: supplier.id,
      purchaseDate: shiftDays(today, -40),
      isOpeningStock: false,
      paidNow: 0,
      items: [
        {
          productId: qtyProducts[0].id,
          quantity: 20,
          unitCost: 40000,
        },
      ],
      notes: 'seed:demo-analytics payable',
    },
    shopId,
    userId,
  );

  let phonesBought = 0;
  for (let pi = 0; pi < phoneProducts.length; pi++) {
    const phone = phoneProducts[pi];
    const units = [];
    for (let u = 0; u < 8; u++) {
      const pair = imeiPair(shopIdx * 100 + pi, u + (Date.now() % 1000));
      units.push({
        imei1: pair.imei1,
        imei2: pair.imei2,
        condition: u % 3 === 0 ? 'USED' : 'NEW',
      });
    }
    try {
      await purchasesService.createPurchase(
        {
          clientRequestId: randomUUID(),
          supplierId: supplier.id,
          purchaseDate: shiftDays(today, -(10 + pi * 20)),
          isOpeningStock: true,
          paidNow: 0,
          items: [
            {
              productId: phone.id,
              quantity: units.length,
              unitCost: 15_000_000 + pi * 500_000,
              phoneUnits: units,
            },
          ],
          notes: 'seed:demo-analytics phones',
        },
        shopId,
        userId,
      );
      phonesBought += units.length;
    } catch (err) {
      console.warn(
        `phone stock skip ${shop.name}/${phone.name}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  // Force a few low-stock attention rows
  for (const p of qtyProducts.slice(0, 3)) {
    await prisma.product.update({
      where: { id: p.id },
      data: { lowStockThreshold: 5000 },
    });
  }

  const customerSpecs = [
    { name: `An Udhar 0-7 ${shopIdx}`, opening: 0 },
    { name: `An Udhar 8-30 ${shopIdx}`, opening: 0 },
    { name: `An Udhar 31-60 ${shopIdx}`, opening: 0 },
    { name: `An Udhar 60+ ${shopIdx}`, opening: 3_500_000 },
    { name: `An Cash Buyer ${shopIdx}`, opening: 0 },
    { name: `An Partial ${shopIdx}`, opening: 500_000 },
    { name: `An Wholesale ${shopIdx}`, opening: 0 },
    { name: `An Walkup ${shopIdx}`, opening: 0 },
  ];
  const customers = [];
  for (const spec of customerSpecs) {
    await customersService.createCustomer(
      {
        name: spec.name,
        openingBalance: spec.opening,
        notes: 'seed:demo-analytics',
      },
      shopId,
      userId,
    );
    const created = await prisma.customer.findFirst({
      where: { shopId, name: spec.name },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    });
    if (created) customers.push(created);
  }

  let salesCreated = 0;
  let expensesCreated = 0;
  let paymentsCreated = 0;
  let returnsCreated = 0;
  let supplierPays = 0;
  const saleIdsForReturn = [];
  const saleDays = 90;

  for (let i = 0; i < maxSales; i++) {
    const dayOffset = -(i % saleDays);
    const saleDate = shiftDays(today, dayOffset);
    const product = qtyProducts[i % qtyProducts.length];
    const product2 = qtyProducts[(i + 3) % qtyProducts.length];
    const isUdhar = i % 5 === 0;
    const customer = isUdhar
      ? customers[i % Math.min(4, customers.length)]
      : (customers[4 + (i % Math.max(1, customers.length - 4))] ??
        customers[0]);

    const unitPrice = 70_000 + (i % 9) * 8_000 + shopIdx * 500;
    const qty = i % 11 === 0 ? 2 : 1;
    const lineTotal = unitPrice * qty;
    const multi =
      i % 8 === 0 && product.id !== product2.id
        ? [
            { productId: product.id, quantity: qty, unitPrice },
            {
              productId: product2.id,
              quantity: 1,
              unitPrice: unitPrice - 5000,
            },
          ]
        : [{ productId: product.id, quantity: qty, unitPrice }];

    const subtotal = multi.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
    const paidNow = isUdhar
      ? Math.floor(subtotal * (0.15 + (i % 4) * 0.1))
      : subtotal;

    try {
      await salesService.createSale(
        {
          clientRequestId: randomUUID(),
          customerId: customer?.id,
          saleDate,
          paidNow,
          dueDate: isUdhar ? shiftDays(saleDate, 7 + (i % 20)) : undefined,
          items: multi,
          notes: 'seed:demo-analytics',
        },
        shopId,
        userId,
      );
      salesCreated += 1;
    } catch (err) {
      console.warn(
        `sale fail ${shop.name}#${i}: ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    if (i % 17 === 0 && !isUdhar) {
      const sale = await prisma.sale.findFirst({
        where: { shopId, notes: 'seed:demo-analytics', status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          items: { select: { id: true, quantity: true }, take: 1 },
        },
      });
      if (sale?.items?.[0]) saleIdsForReturn.push(sale);
    }

    if (expenseCats.length && i % 6 === 0) {
      const cat = expenseCats[i % expenseCats.length];
      await expensesService.createExpense(
        {
          categoryId: cat.id,
          amount: 80_000 + (i % 7) * 35_000 + shopIdx * 1000,
          expenseDate: saleDate,
          notes: 'seed:demo-analytics',
        },
        shopId,
        userId,
      );
      expensesCreated += 1;
    }

    if (isUdhar && customer && i % 9 === 0) {
      try {
        await paymentsService.createPayment(
          {
            clientRequestId: randomUUID(),
            customerId: customer.id,
            amount: 50_000 + (i % 5) * 25_000,
            paymentDate: saleDate,
            notes: 'seed:demo-analytics',
          },
          shopId,
          userId,
        );
        paymentsCreated += 1;
      } catch {
        /* outstanding too low */
      }
    }

    if (i === Math.floor(maxSales / 2)) {
      try {
        await supplierPaymentsService.createSupplierPayment(
          {
            supplierId: supplier.id,
            amount: 200_000,
            paymentDate: saleDate,
            notes: 'seed:demo-analytics',
            confirmOverdraft: true,
          },
          shopId,
          userId,
        );
        supplierPays += 1;
      } catch {
        /* ignore */
      }
    }
  }

  for (const sale of saleIdsForReturn.slice(0, 12)) {
    const item = sale.items[0];
    try {
      await returnsService.createReturn(
        sale.id,
        {
          reason: 'seed:demo-analytics return',
          returnDate: today,
          refundAmount: 0,
          items: [
            {
              saleItemId: item.id,
              quantity: 1,
              condition: 'GOOD',
            },
          ],
        },
        shopId,
        userId,
      );
      returnsCreated += 1;
    } catch {
      /* ignore */
    }
  }

  // Sell a few phones so sales-mix SERIALIZED has data
  const inStockPhones = await prisma.inventoryUnit.findMany({
    where: { shopId, status: 'IN_STOCK' },
    select: { id: true, productId: true, unitCost: true },
    take: 6,
  });
  let phoneSales = 0;
  for (let i = 0; i < inStockPhones.length; i++) {
    const unit = inStockPhones[i];
    const price = Number(unit.unitCost) + 2_000_000;
    try {
      await salesService.createSale(
        {
          clientRequestId: randomUUID(),
          customerId: customers[i % customers.length]?.id,
          saleDate: shiftDays(today, -(i * 3 + 1)),
          paidNow: i % 2 === 0 ? price : Math.floor(price * 0.5),
          items: [
            {
              productId: unit.productId,
              inventoryUnitId: unit.id,
              quantity: 1,
              unitPrice: price,
              warrantyDays: 3,
            },
          ],
          notes: 'seed:demo-analytics phone sale',
        },
        shopId,
        userId,
      );
      phoneSales += 1;
      salesCreated += 1;
    } catch {
      /* skip */
    }
  }

  const cash = await prisma.cashMovement.groupBy({
    by: ['direction'],
    where: { shopId },
    _sum: { amount: true },
  });
  const cashIn = Number(
    cash.find((r) => r.direction === 'IN')?._sum.amount ?? 0n,
  );
  const cashOut = Number(
    cash.find((r) => r.direction === 'OUT')?._sum.amount ?? 0n,
  );

  return {
    shop: shop.name,
    sales: salesCreated,
    phoneSales,
    phonesBought,
    expenses: expensesCreated,
    payments: paymentsCreated,
    returns: returnsCreated,
    supplierPays,
    customers: customers.length,
    products: qtyProducts.length,
    cashNet: cashIn - cashOut,
  };
}

async function main() {
  const allowRemote =
    process.env.ALLOW_REMOTE_SEED === 'true' ||
    process.argv.includes('--force');
  if (databaseLooksShared() && !allowRemote) {
    throw new Error(
      'Refusing to seed: DATABASE_URL is not localhost. Set ALLOW_REMOTE_SEED=true or pass --force.',
    );
  }

  const named = (process.env.SEED_DEMO_SHOP_NAME || '').trim();
  const limit = Math.max(
    1,
    Math.min(40, Number(process.env.SEED_DEMO_SHOP_LIMIT || 8)),
  );
  const maxSales = Math.min(
    600,
    Math.max(50, Number(process.env.SEED_DEMO_MAX_SALES || 420)),
  );

  const { AppModule } = await import('../dist/app.module.js');
  const { PrismaService } = await import('../dist/prisma/prisma.service.js');
  const { SalesService } =
    await import('../dist/sales/services/sales.service.js');
  const { ExpensesService } =
    await import('../dist/expenses/services/expenses.service.js');
  const { PaymentsService } =
    await import('../dist/payments/services/payments.service.js');
  const { CustomersService } =
    await import('../dist/customers/services/customers.service.js');
  const { PurchasesService } =
    await import('../dist/purchases/services/purchases.service.js');
  const { ReturnsService } =
    await import('../dist/returns/services/returns.service.js');
  const { SupplierPaymentsService } =
    await import('../dist/supplier-payments/services/supplier-payments.service.js');
  const { TrackingType } = await import('../dist/generated/prisma/enums.js');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const prisma = app.get(PrismaService);
    const ctx = {
      prisma,
      salesService: app.get(SalesService),
      expensesService: app.get(ExpensesService),
      paymentsService: app.get(PaymentsService),
      customersService: app.get(CustomersService),
      purchasesService: app.get(PurchasesService),
      returnsService: app.get(ReturnsService),
      supplierPaymentsService: app.get(SupplierPaymentsService),
      TrackingType,
    };

    let shops;
    if (named) {
      const one = await prisma.shop.findFirst({
        where: { name: named },
        select: { id: true, name: true },
      });
      shops = one ? [one] : [];
    } else {
      shops = await prisma.shop.findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
    }

    if (!shops.length) {
      throw new Error('No shops found to seed.');
    }

    const today = businessTodayKarachi();
    console.log(
      `Seeding ${shops.length} shop(s), ~${maxSales} sales each (${today})…`,
    );

    const summaries = [];
    for (let i = 0; i < shops.length; i++) {
      console.log(`→ ${shops[i].name}`);
      const summary = await seedOneShop(ctx, shops[i], i, today, maxSales);
      if (summary) {
        summaries.push(summary);
        console.log(
          `  sales=${summary.sales} phones=${summary.phoneSales}/${summary.phonesBought} exp=${summary.expenses} pay=${summary.payments} ret=${summary.returns}`,
        );
      }
    }

    console.log('\nseed:demo-analytics complete');
    console.log(
      JSON.stringify({ shops: summaries.length, summaries }, null, 2),
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
