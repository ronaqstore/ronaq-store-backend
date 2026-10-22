/**
 * Large functional demo seed for pagination / filter / search / sort testing.
 *
 * Creates shops with realistic multi-tenant data: brands, categories, products
 * (new + used phones, accessories), images, suppliers, customers, purchases,
 * sales, stock adjustments (ADJUSTMENT / DAMAGED / LOST), payments, expenses,
 * and cash movements. Adjustments update live stock_levels / inventory_units.
 *
 * Env (defaults in parentheses):
 *   SEED_SHOP_COUNT (120)
 *   SEED_PRODUCTS_PER_CATEGORY (40)
 *   SEED_CUSTOMERS_PER_SHOP (40)
 *   SEED_SUPPLIERS_PER_SHOP (40)
 *   SEED_PURCHASES_PER_SHOP (48)
 *   SEED_SALES_PER_SHOP (48)
 *   SEED_ADJUSTMENTS_PER_SHOP (36)
 *   SEED_EXPENSES_PER_SHOP (40)
 *   SEED_OWNER_PASSWORD (admin@123)
 *   SEED_OWNER_PHONE — used as login for shop #1
 *
 * Usage:
 *   npm run seed
 *   ALLOW_REMOTE_SEED=true npm run seed -- --force
 */
const crypto = require('crypto');
const {
  DEFAULT_BRANDS,
  DEFAULT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  WALK_IN_SUPPLIER,
} = require('../dist/platform-admin/constants/default-lists.constant.js');
const { normalizePhone, normalizePhoneOrRaw } = require('../dist/helpers/phone.helper.js');
const {
  storeSlugBase,
  nextFreeStoreSlug,
} = require('../dist/store/helpers/store-slug.helper.js');

const SERIALIZED_CATEGORIES = new Set(['Mobile Phones', 'Tablets & iPads']);

const PAYMENT_METHODS = ['CASH', 'JAZZCASH', 'EASYPAISA', 'BANK'];

const CUSTOMER_PAYMENT_NOTES = [
  'Paid in full at counter',
  'Partial / udhar remaining',
  'JazzCash received — SMS confirmed',
  'EasyPaisa transfer',
  'Bank deposit slip attached',
  'Advance against next bill',
  'Cleared opening balance',
  'Customer paid after return adjustment',
];

const SUPPLIER_PAYMENT_NOTES = [
  'Partial supplier payment',
  'Full settlement this week',
  'Advance against next invoice',
  'Bank transfer — receipt filed',
  'Cash paid at warehouse',
  'Cleared old payable',
  'Discount adjusted in notes',
  'Paid against multiple bills',
];

const CUSTOMER_NOTES = [
  'Regular customer',
  'Prefers JazzCash',
  'Wholesale buyer',
  'Walk-in / cash only',
  'Corporate account',
  null,
  'Needs invoice copy',
  'Good payment history',
];

const SUPPLIER_NOTES = [
  'Wholesale distributor',
  'Local supplier',
  'Karachi warehouse',
  'Credit terms 15 days',
  'Cash on delivery only',
  'Preferred for used stock',
  null,
  'Sends weekly price list',
];

const SALE_NOTES = [
  'Counter sale',
  'Display unit sold',
  'Online inquiry → store pickup',
  'Bulk order for shop',
  'Exchange deal',
  null,
  'Warranty card issued',
  'Gift wrap requested',
];

const PURCHASE_NOTES = [
  'Fresh wholesale stock',
  'Used / trade-in stock',
  'Festival stock refill',
  'Urgent restock',
  'Opening stock entry',
  'Supplier promo lot',
  null,
  'Damaged carton claim pending',
];

async function updateInBatches(items, batchSize, updateOne) {
  for (let start = 0; start < items.length; start += batchSize) {
    const slice = items.slice(start, start + batchSize);
    await Promise.all(slice.map((item, offset) => updateOne(item, start + offset)));
  }
}

function cancelledFields(isCancelled, cancelledById) {
  if (!isCancelled) {
    return {
      status: 'ACTIVE',
      cancelledAt: null,
      cancelReason: null,
      cancelledById: null,
    };
  }
  return {
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelReason: 'Demo seed — sample cancelled row',
    cancelledById,
  };
}

async function mixupShopDemoData(prisma, shopId) {
  const summary = {
    payments: 0,
    supplierPayments: 0,
    expenses: 0,
    customers: 0,
    suppliers: 0,
    products: 0,
    sales: 0,
    purchases: 0,
  };

  const actor =
    (await prisma.user.findFirst({
      where: { shopId, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })) ??
    (await prisma.user.findFirst({
      where: { shopId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }));
  const cancelledById = actor?.id ?? null;
  if (!cancelledById) {
    return summary;
  }

  const payments = await prisma.payment.findMany({
    where: { shopId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  await updateInBatches(payments, 40, (row, i) =>
    prisma.payment.update({
      where: { id: row.id },
      data: {
        method: PAYMENT_METHODS[i % PAYMENT_METHODS.length],
        notes: pick(CUSTOMER_PAYMENT_NOTES, i),
        ...cancelledFields(i % 5 === 0, cancelledById),
      },
    }),
  );
  summary.payments = payments.length;

  const supplierPayments = await prisma.supplierPayment.findMany({
    where: { shopId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  await updateInBatches(supplierPayments, 40, (row, i) =>
    prisma.supplierPayment.update({
      where: { id: row.id },
      data: {
        notes: pick(SUPPLIER_PAYMENT_NOTES, i),
        ...cancelledFields(i % 5 === 0, cancelledById),
      },
    }),
  );
  summary.supplierPayments = supplierPayments.length;

  const expenses = await prisma.expense.findMany({
    where: { shopId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  await updateInBatches(expenses, 40, (row, i) =>
    prisma.expense.update({
      where: { id: row.id },
      data: {
        description: pick(EXPENSE_NOTES, i),
        ...cancelledFields(i % 6 === 0, cancelledById),
      },
    }),
  );
  summary.expenses = expenses.length;

  const customers = await prisma.customer.findMany({
    where: { shopId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  await updateInBatches(customers, 40, (row, i) =>
    prisma.customer.update({
      where: { id: row.id },
      data: {
        notes: pick(CUSTOMER_NOTES, i),
        isActive: i % 6 !== 0,
      },
    }),
  );
  summary.customers = customers.length;

  const suppliers = await prisma.supplier.findMany({
    where: { shopId, isSystem: false },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  await updateInBatches(suppliers, 40, (row, i) =>
    prisma.supplier.update({
      where: { id: row.id },
      data: {
        notes: pick(SUPPLIER_NOTES, i),
        isActive: i % 7 !== 0,
      },
    }),
  );
  summary.suppliers = suppliers.length;

  const products = await prisma.product.findMany({
    where: { shopId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  await updateInBatches(products, 50, (row, i) =>
    prisma.product.update({
      where: { id: row.id },
      data: {
        isActive: i % 6 !== 0,
        isPublished: i % 4 !== 0,
      },
    }),
  );
  summary.products = products.length;

  const sales = await prisma.sale.findMany({
    where: { shopId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  await updateInBatches(sales, 40, (row, i) =>
    prisma.sale.update({
      where: { id: row.id },
      data: {
        notes: pick(SALE_NOTES, i),
        ...cancelledFields(i % 8 === 0, cancelledById),
      },
    }),
  );
  summary.sales = sales.length;

  const purchases = await prisma.purchase.findMany({
    where: { shopId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  await updateInBatches(purchases, 40, (row, i) =>
    prisma.purchase.update({
      where: { id: row.id },
      data: {
        notes: pick(PURCHASE_NOTES, i),
        ...cancelledFields(i % 9 === 0, cancelledById),
      },
    }),
  );
  summary.purchases = purchases.length;

  return summary;
}

const CITIES = [
  { city: 'Lahore', area: 'Hall Road', lat: 31.5656, lng: 74.3142 },
  { city: 'Karachi', area: 'Saddar', lat: 24.8615, lng: 67.0099 },
  { city: 'Islamabad', area: 'Blue Area', lat: 33.7294, lng: 73.0931 },
  { city: 'Peshawar', area: 'Saddar Bazaar', lat: 34.0151, lng: 71.5785 },
  { city: 'Faisalabad', area: 'Clock Tower', lat: 31.4504, lng: 73.135 },
  { city: 'Multan', area: 'Hussain Agahi', lat: 30.1575, lng: 71.5249 },
  { city: 'Rawalpindi', area: 'Raja Bazaar', lat: 33.5973, lng: 73.0479 },
  { city: 'Hyderabad', area: 'Resham Gali', lat: 25.396, lng: 68.3578 },
  { city: 'Quetta', area: 'Liaquat Bazaar', lat: 30.1798, lng: 66.975 },
  { city: 'Sialkot', area: 'Trunk Bazaar', lat: 32.4945, lng: 74.5229 },
];

const FIRST_NAMES = [
  'Ahmed', 'Ali', 'Hassan', 'Usman', 'Bilal', 'Hamza', 'Omar', 'Zain', 'Saad', 'Farhan',
  'Ayesha', 'Fatima', 'Sana', 'Hira', 'Maryam', 'Iqra', 'Noor', 'Zara', 'Laiba', 'Maham',
  'Kashif', 'Naveed', 'Imran', 'Shahid', 'Rizwan', 'Asad', 'Waqas', 'Tariq', 'Junaid', 'Adnan',
  'Saima', 'Nadia', 'Rabia', 'Mehwish', 'Bushra', 'Sadia', 'Kinza', 'Anam', 'Hina', 'Saba',
];

const LAST_NAMES = [
  'Khan', 'Ali', 'Ahmed', 'Hussain', 'Malik', 'Sheikh', 'Raza', 'Butt', 'Qureshi', 'Shah',
  'Abbasi', 'Mirza', 'Chaudhry', 'Siddiqui', 'Hashmi', 'Dar', 'Baig', 'Yousaf', 'Iqbal', 'Nawaz',
];

const PHONE_MODELS = {
  Apple: ['iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 15 Pro', 'iPhone 16', 'iPhone SE'],
  Samsung: ['Galaxy S23', 'Galaxy S24', 'Galaxy A54', 'Galaxy A35', 'Galaxy Z Flip5', 'Galaxy M34'],
  Xiaomi: ['Redmi Note 13', 'Redmi 13C', 'Xiaomi 14', 'POCO X6', 'Redmi Note 12'],
  Vivo: ['V29', 'Y27', 'V30', 'Y36', 'X100'],
  Oppo: ['Reno11', 'A78', 'Find X6', 'A59', 'Reno10'],
  Infinix: ['Hot 40', 'Note 30', 'Zero 30', 'Smart 8', 'GT 20'],
  Tecno: ['Spark 20', 'Camon 30', 'Pova 5', 'Phantom V', 'Spark Go'],
  Realme: ['C67', '12 Pro', 'Narzo 70', 'GT 6', 'C55'],
  OnePlus: ['Nord CE 3', '12R', 'Nord 3', '11', 'Nord N30'],
  itel: ['A70', 'S24', 'P55', 'A60s', 'S23'],
  Honor: ['X8b', '90', 'Magic6', 'X9b', '200'],
  'Google Pixel': ['Pixel 7', 'Pixel 8', 'Pixel 8a', 'Pixel 9', 'Pixel 6a'],
  Ronin: ['R-10', 'R-20', 'R-Pro'],
  Faster: ['F-100', 'F-200', 'F-Lite'],
  Anker: ['A-Phone Case Kit'],
};

const TABLET_MODELS = {
  Apple: ['iPad 10th', 'iPad Air', 'iPad Pro 11', 'iPad mini'],
  Samsung: ['Galaxy Tab S9', 'Galaxy Tab A9', 'Galaxy Tab S9 FE'],
  Xiaomi: ['Redmi Pad SE', 'Pad 6'],
  default: ['Tablet 10"', 'Tablet 8"'],
};

const ACCESSORY_NAMES = {
  'Smart Watches': ['Active Watch', 'Pro Watch', 'Fit Band', 'Sport Watch'],
  'Wireless Earbuds': ['Buds Pro', 'Buds Lite', 'AirPods Style', 'TWS ANC'],
  Earphones: ['Wired Earphones', 'Type-C Earphones', '3.5mm Earphones'],
  'Power Banks': ['10000mAh Power Bank', '20000mAh Power Bank', 'Fast Charge Bank'],
  'Chargers & Cables': ['20W Charger', '25W Charger', 'USB-C Cable', 'Lightning Cable', '65W GaN'],
  'Cases & Covers': ['Silicone Case', 'Clear Case', 'Leather Case', 'Rugged Case'],
  'Screen Guards': ['Tempered Glass', 'Privacy Glass', 'Matte Protector', 'Hydrogel Film'],
  Speakers: ['Bluetooth Speaker', 'Mini Speaker', 'Party Speaker'],
  'Storage & Memory Cards': ['64GB MicroSD', '128GB MicroSD', '256GB MicroSD', 'OTG Pendrive'],
  Accessories: ['Car Mount', 'Selfie Stick', 'Phone Stand', 'Cleaning Kit', 'Ring Holder'],
};

const COLORS = ['Black', 'White', 'Blue', 'Green', 'Gold', 'Silver', 'Purple', 'Graphite', 'Red'];
const STORAGE = ['64GB', '128GB', '256GB', '512GB'];
const RAM = ['4GB', '6GB', '8GB', '12GB'];
const PTA = ['PTA_APPROVED', 'NON_PTA', 'JV', 'BYPASS'];
const EXPENSE_NOTES = [
  'Shop rent installment',
  'Electricity bill WAPDA',
  'PTCL / fiber internet',
  'Staff salary advance',
  'Delivery / rikshaw',
  'AC repair & parts',
  'Facebook ads boost',
  'Misc stationery',
  'Generator fuel',
  'Cleaning supplies',
];

const ADJUSTMENT_REASONS = [
  'Physical count correction after festival rush',
  'Shelf recount — system qty was wrong',
  'Opening stock recount',
  'Transferred display unit back to shelf',
  'Found missing carton in store room',
];

const DAMAGE_REASONS = [
  'Water damage in transit',
  'Screen cracked on display unit',
  'Customer return — board short',
  'Packaging crushed — unit unusable',
  'Charging port damaged on demo piece',
];

const LOST_REASONS = [
  'Missing after weekly stocktake',
  'Theft suspected from display shelf',
  'Lost in delivery — courier claim pending',
  'Unit not found after shop renovation',
  'IMEI mismatch — written off as lost',
];

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function paisa(rupees) {
  return BigInt(Math.round(rupees * 100));
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 8), n % 60, 0, 0);
  return d;
}

function dateOnly(d) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function imageUrl(seed, w = 640, h = 640) {
  return `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/${w}/${h}`;
}

function ownerPhoneLocal(shopIndex) {
  return `0302${String(shopIndex + 1).padStart(7, '0')}`;
}

function customerPhoneLocal(shopIndex, customerIndex) {
  const n = shopIndex * 100 + customerIndex + 1;
  return `0311${String(n).padStart(7, '0')}`;
}

function supplierPhoneLocal(shopIndex, supplierIndex) {
  const n = shopIndex * 100 + supplierIndex + 1;
  return `0322${String(n).padStart(7, '0')}`;
}

function imeiPair(shopIndex, seq) {
  const base = 350000000000000n + BigInt(shopIndex) * 10000000n + BigInt(seq);
  const imei1 = String(base);
  const imei2 = String(base + 50000000000000n);
  return { imei1, imei2 };
}

function productTitle(categoryName, brandName, index) {
  if (categoryName === 'Mobile Phones') {
    const models = PHONE_MODELS[brandName] || [`${brandName} Phone`];
    return `${pick(models, index)} ${pick(STORAGE, index)}`;
  }
  if (categoryName === 'Tablets & iPads') {
    const models = TABLET_MODELS[brandName] || TABLET_MODELS.default;
    return `${pick(models, index)} ${pick(STORAGE, index)}`;
  }
  const names = ACCESSORY_NAMES[categoryName] || ['Accessory'];
  return `${brandName} ${pick(names, index)}`;
}

function buildProductRow({
  shopId,
  category,
  brand,
  index,
  skuSuffix,
}) {
  const isSerialized = SERIALIZED_CATEGORIES.has(category.name);
  const name = productTitle(category.name, brand.name, index);
  const color = pick(COLORS, index);
  const storage = isSerialized ? pick(STORAGE, index) : null;
  const ram = isSerialized && category.name === 'Mobile Phones' ? pick(RAM, index) : null;
  const purchaseRs = isSerialized
    ? 18000 + (index % 40) * 3500 + (brand.name === 'Apple' ? 40000 : 0)
    : 200 + (index % 20) * 150;
  const sellRs = Math.round(purchaseRs * (1.12 + (index % 5) * 0.02));
  const authenticity = isSerialized
    ? null
    : index % 3 === 0
      ? 'COPY'
      : 'ORIGINAL';
  let ptaStatus = null;
  if (isSerialized) {
    if (brand.name === 'Apple') {
      ptaStatus = pick(['PTA_APPROVED', 'NON_PTA', 'JV', 'BYPASS', 'MDM_BYPASS'], index);
    } else {
      ptaStatus = pick(['PTA_APPROVED', 'NON_PTA'], index);
    }
  }

  return {
    shopId,
    categoryId: category.id,
    brandId: brand.id,
    name,
    trackingType: isSerialized ? 'SERIALIZED' : 'QUANTITY',
    model: name.split(' ').slice(0, 3).join(' '),
    color,
    ram,
    storage,
    sku: `SKU-${skuSuffix}`,
    barcode: `89${String(skuSuffix).padStart(11, '0')}`,
    description: `${name} — shop inventory`,
    publicDescription: `${name} available in ${color}. Quality checked.`,
    imageUrl: imageUrl(`p-${skuSuffix}`),
    defaultPurchasePrice: paisa(purchaseRs),
    defaultSellingPrice: paisa(sellRs),
    lowStockThreshold: isSerialized ? 1 : 5,
    isActive: index % 6 !== 0,
    isPublished: index % 4 !== 0,
    publishedAt: index % 4 !== 0 ? daysAgo(index % 20) : null,
    contactForPrice: false,
    ptaStatus,
    authenticity,
  };
}

async function ensureShopBundle(prisma, {
  shopIndex,
  ownerName,
  ownerRawPhone,
  passwordHash,
  shopName,
  cfg,
}) {
  const ownerPhone = normalizePhone(ownerRawPhone);
  if (!ownerPhone) {
    throw new Error(`Invalid owner phone for shop ${shopIndex + 1}: ${ownerRawPhone}`);
  }

  const existing = await prisma.user.findUnique({
    where: { phone: ownerPhone },
    include: { shop: true },
  });

  if (existing) {
    const productCount = await prisma.product.count({ where: { shopId: existing.shopId } });
    const expectedProducts = cfg.productsPerCategory * DEFAULT_CATEGORIES.length;
    if (productCount >= expectedProducts) {
      const adjustmentsNow = await seedManualAdjustments(prisma, existing.shop, cfg);
      const mixed = await mixupShopDemoData(prisma, existing.shopId);
      console.log(
        `  ↪ Shop ${shopIndex + 1} already seeded (${existing.shop.name}) — adjustments=${adjustmentsNow} mixed payments=${mixed.payments} supplierPayments=${mixed.supplierPayments}`,
      );
      return { shop: existing.shop, owner: existing, skipped: true };
    }
    console.log(`  ↪ Shop ${shopIndex + 1} exists but incomplete — filling data…`);
    return seedShopBusinessData(prisma, existing.shop, existing, shopIndex, cfg);
  }

  const place = pick(CITIES, shopIndex);
  const oneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const shop = await prisma.shop.create({
    data: {
      name: shopName,
      phone: normalizePhoneOrRaw(ownerRawPhone),
      address: `${place.area}, ${place.city}`,
      status: 'ACTIVE',
      subscriptionEndsAt: oneYear,
    },
  });

  const owner = await prisma.user.create({
    data: {
      shopId: shop.id,
      name: ownerName,
      phone: ownerPhone,
      passwordHash,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((name) => ({ shopId: shop.id, name })),
    skipDuplicates: true,
  });
  await prisma.brand.createMany({
    data: DEFAULT_BRANDS.map((name) => ({ shopId: shop.id, name })),
    skipDuplicates: true,
  });
  await prisma.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ shopId: shop.id, name })),
    skipDuplicates: true,
  });
  await prisma.supplier.create({
    data: {
      shopId: shop.id,
      name: WALK_IN_SUPPLIER.name,
      notes: WALK_IN_SUPPLIER.notes,
      isSystem: WALK_IN_SUPPLIER.isSystem,
    },
  });

  const storeSlug = await nextFreeStoreSlug(
    storeSlugBase(shop.name, shop.id),
    async (candidate) =>
      Boolean(
        await prisma.shopStoreSettings.findUnique({
          where: { slug: candidate },
          select: { slug: true },
        }),
      ),
  );

  await prisma.shopStoreSettings.create({
    data: {
      shopId: shop.id,
      slug: storeSlug,
      isEnabled: true,
      displayName: shop.name.slice(0, 100),
      about: `${shop.name} — mobiles, tablets & genuine accessories in ${place.city}.`,
      logoUrl: imageUrl(`logo-${shopIndex + 1}`, 256, 256),
      bannerUrl: imageUrl(`banner-${shopIndex + 1}`, 1200, 400),
      whatsappNumber: ownerPhone,
      phoneNumber: ownerPhone,
      address: shop.address,
      city: place.city,
      latitude: place.lat + (shopIndex % 7) * 0.01,
      longitude: place.lng + (shopIndex % 5) * 0.01,
      mapPlaceName: `${place.area}, ${place.city}`,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`,
      openingHours: '10:00-21:00',
      facebookUrl: 'https://facebook.com/ronaqstore',
      instagramUrl: 'https://instagram.com/ronaqstore',
      showExactStock: shopIndex % 2 === 0,
    },
  });

  return seedShopBusinessData(prisma, shop, owner, shopIndex, cfg);
}

async function seedShopBusinessData(prisma, shop, owner, shopIndex, cfg) {
  const categories = await prisma.category.findMany({
    where: { shopId: shop.id },
    orderBy: { name: 'asc' },
  });
  const brands = await prisma.brand.findMany({
    where: { shopId: shop.id },
    orderBy: { name: 'asc' },
  });
  const expenseCats = await prisma.expenseCategory.findMany({
    where: { shopId: shop.id },
    orderBy: { name: 'asc' },
  });

  if (categories.length === 0 || brands.length === 0) {
    throw new Error(`Shop ${shop.name} missing categories/brands`);
  }

  const existingProducts = await prisma.product.count({ where: { shopId: shop.id } });
  const expectedProducts = cfg.productsPerCategory * categories.length;
  if (existingProducts < expectedProducts) {
    const productRows = [];
    let skuSeq = existingProducts + 1;
    for (const category of categories) {
      const alreadyInCat = await prisma.product.count({
        where: { shopId: shop.id, categoryId: category.id },
      });
      for (let i = alreadyInCat; i < cfg.productsPerCategory; i += 1) {
        const brand = pick(brands, i + categories.indexOf(category));
        const skuSuffix = `${String(shopIndex + 1).padStart(2, '0')}${String(skuSeq).padStart(5, '0')}`;
        productRows.push(
          buildProductRow({
            shopId: shop.id,
            category,
            brand,
            index: i,
            skuSuffix,
          }),
        );
        skuSeq += 1;
      }
    }

    for (let i = 0; i < productRows.length; i += 200) {
      await prisma.product.createMany({ data: productRows.slice(i, i + 200) });
    }

    const newProducts = await prisma.product.findMany({
      where: {
        shopId: shop.id,
        images: { none: {} },
      },
      select: { id: true, sku: true },
    });

    const imageRows = [];
    for (const p of newProducts) {
      const n = 1 + (String(p.sku || '0').charCodeAt(String(p.sku || '0').length - 1) % 3);
      for (let s = 0; s < n; s += 1) {
        imageRows.push({
          shopId: shop.id,
          productId: p.id,
          url: imageUrl(`${p.sku}-img-${s}`),
          sortOrder: s,
        });
      }
    }
    for (let i = 0; i < imageRows.length; i += 400) {
      await prisma.productImage.createMany({ data: imageRows.slice(i, i + 400) });
    }
  }

  const products = await prisma.product.findMany({
    where: { shopId: shop.id },
    select: {
      id: true,
      name: true,
      trackingType: true,
      defaultPurchasePrice: true,
      defaultSellingPrice: true,
      sku: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const serialized = products.filter((p) => p.trackingType === 'SERIALIZED');
  const quantity = products.filter((p) => p.trackingType === 'QUANTITY');

  const supplierCount = await prisma.supplier.count({
    where: { shopId: shop.id, isSystem: false },
  });
  if (supplierCount < cfg.suppliersPerShop) {
    const rows = [];
    for (let i = supplierCount; i < cfg.suppliersPerShop; i += 1) {
      const name = `${pick(FIRST_NAMES, i)} ${pick(LAST_NAMES, i + 3)} Traders`;
      rows.push({
        shopId: shop.id,
        name,
        phone: normalizePhone(supplierPhoneLocal(shopIndex, i)),
        cnic: `${String(3000000000000 + shopIndex * 1000 + i + 1)}`,
        address: `${pick(CITIES, i).area}, ${pick(CITIES, i).city}`,
        notes: pick(SUPPLIER_NOTES, i),
        openingBalance: i % 7 === 0 ? paisa(5000 + i * 100) : 0n,
        isSystem: false,
        isActive: i % 7 !== 0,
      });
    }
    await prisma.supplier.createMany({ data: rows });
  }

  const customerCount = await prisma.customer.count({ where: { shopId: shop.id } });
  if (customerCount < cfg.customersPerShop) {
    const rows = [];
    for (let i = customerCount; i < cfg.customersPerShop; i += 1) {
      rows.push({
        shopId: shop.id,
        name: `${pick(FIRST_NAMES, i + 5)} ${pick(LAST_NAMES, i + 8)}`,
        phone: normalizePhone(customerPhoneLocal(shopIndex, i)),
        address: `${10 + i} Street, ${pick(CITIES, i).city}`,
        notes: pick(CUSTOMER_NOTES, i),
        openingBalance: i % 9 === 0 ? paisa(1000 + i * 50) : 0n,
        isActive: i % 6 !== 0,
      });
    }
    await prisma.customer.createMany({ data: rows });
  }

  const suppliers = await prisma.supplier.findMany({
    where: { shopId: shop.id, isSystem: false },
    orderBy: { createdAt: 'asc' },
  });
  const walkIn = await prisma.supplier.findFirst({
    where: { shopId: shop.id, isSystem: true },
  });
  const customers = await prisma.customer.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: 'asc' },
  });

  const openingCash = await prisma.cashMovement.findFirst({
    where: { shopId: shop.id, type: 'OPENING_CASH' },
  });
  if (!openingCash) {
    await prisma.cashMovement.create({
      data: {
        shopId: shop.id,
        type: 'OPENING_CASH',
        direction: 'IN',
        amount: paisa(80000 + shopIndex * 1000),
        movementDate: daysAgo(90),
        note: 'Opening float',
        createdById: owner.id,
      },
    });
    for (let i = 0; i < 8; i += 1) {
      const invest = i % 2 === 0;
      await prisma.cashMovement.create({
        data: {
          shopId: shop.id,
          type: invest ? 'OWNER_INVESTMENT' : 'OWNER_WITHDRAWAL',
          direction: invest ? 'IN' : 'OUT',
          amount: paisa(5000 + i * 700),
          movementDate: daysAgo(80 - i * 3),
          note: invest ? 'Owner cash in' : 'Owner cash out',
          createdById: owner.id,
        },
      });
    }
  }

  const purchaseCount = await prisma.purchase.count({ where: { shopId: shop.id } });
  let nextPurchaseNo = purchaseCount + 1;
  let unitSeq = shopIndex * 100000 + 1;
  const inStockUnits = [];

  if (purchaseCount < cfg.purchasesPerShop) {
    const need = cfg.purchasesPerShop - purchaseCount;
    for (let p = 0; p < need; p += 1) {
      const supplier =
        p % 11 === 0 && walkIn
          ? walkIn
          : pick(suppliers, p);
      const purchaseNo = `P-${String(nextPurchaseNo).padStart(4, '0')}`;
      nextPurchaseNo += 1;
      const purchaseDate = dateOnly(daysAgo(70 - (p % 65)));
      const isUsedLot = p % 4 === 0;
      const itemCount = 2 + (p % 4);
      const pickedProducts = [];
      for (let k = 0; k < itemCount; k += 1) {
        const pool = k === 0 && serialized.length ? serialized : quantity.length ? quantity : products;
        pickedProducts.push(pick(pool, p * 5 + k));
      }

      let totalAmount = 0n;
      const itemSpecs = pickedProducts.map((prod, idx) => {
        const qty = prod.trackingType === 'SERIALIZED' ? 1 + (idx % 2) : 8 + ((p + idx) % 20);
        const unitCost =
          prod.defaultPurchasePrice > 0n
            ? prod.defaultPurchasePrice
            : paisa(1000);
        const adjusted =
          isUsedLot && prod.trackingType === 'SERIALIZED'
            ? (unitCost * 75n) / 100n
            : unitCost;
        const totalCost = adjusted * BigInt(qty);
        totalAmount += totalCost;
        return { prod, qty, unitCost: adjusted, totalCost };
      });

      const purchase = await prisma.purchase.create({
        data: {
          shopId: shop.id,
          supplierId: supplier.id,
          purchaseNo,
          supplierInvoiceRef: `INV-${shopIndex + 1}-${1000 + p}`,
          purchaseDate,
          totalAmount,
          isOpeningStock: p === 0,
          ...cancelledFields(p % 9 === 0, owner.id),
          clientRequestId: crypto.randomUUID(),
          notes: pick(PURCHASE_NOTES, p),
          createdById: owner.id,
        },
      });

      for (const spec of itemSpecs) {
        const purchaseItem = await prisma.purchaseItem.create({
          data: {
            shopId: shop.id,
            purchaseId: purchase.id,
            productId: spec.prod.id,
            quantity: spec.qty,
            unitCost: spec.unitCost,
            totalCost: spec.totalCost,
          },
        });

        if (spec.prod.trackingType === 'SERIALIZED') {
          const unitRows = [];
          for (let u = 0; u < spec.qty; u += 1) {
            const { imei1, imei2 } = imeiPair(shopIndex, unitSeq);
            unitSeq += 1;
            const condition = isUsedLot || u % 3 === 2 ? 'USED' : 'NEW';
            unitRows.push({
              shopId: shop.id,
              productId: spec.prod.id,
              purchaseItemId: purchaseItem.id,
              imei1,
              imei2,
              condition,
              unitCost: spec.unitCost,
              batteryHealth: condition === 'USED' ? 78 + ((p + u) % 20) : null,
              askingPrice:
                condition === 'USED'
                  ? (spec.prod.defaultSellingPrice * 90n) / 100n
                  : null,
              defectNotes: condition === 'USED' && u % 4 === 0 ? 'Light scratches on frame' : null,
              status: 'IN_STOCK',
            });
          }
          await prisma.inventoryUnit.createMany({ data: unitRows });
          const createdUnits = await prisma.inventoryUnit.findMany({
            where: { purchaseItemId: purchaseItem.id },
            orderBy: { createdAt: 'asc' },
          });
          await prisma.inventoryMovement.createMany({
            data: createdUnits.map((unit) => ({
              shopId: shop.id,
              productId: spec.prod.id,
              inventoryUnitId: unit.id,
              type: 'PURCHASE',
              quantityChange: 1,
              referenceType: 'PURCHASE',
              referenceId: purchase.id,
            })),
          });
          for (const unit of createdUnits) {
            inStockUnits.push({
              ...unit,
              productId: spec.prod.id,
              unitCost: spec.unitCost,
              sellPrice: spec.prod.defaultSellingPrice,
            });
          }
        } else {
          const existingLevel = await prisma.stockLevel.findUnique({
            where: { productId: spec.prod.id },
          });
          if (existingLevel) {
            const newQty = existingLevel.quantityOnHand + spec.qty;
            const avg =
              (existingLevel.avgUnitCost * BigInt(existingLevel.quantityOnHand) +
                spec.unitCost * BigInt(spec.qty)) /
              BigInt(newQty);
            await prisma.stockLevel.update({
              where: { productId: spec.prod.id },
              data: { quantityOnHand: newQty, avgUnitCost: avg },
            });
          } else {
            await prisma.stockLevel.create({
              data: {
                productId: spec.prod.id,
                shopId: shop.id,
                quantityOnHand: spec.qty,
                avgUnitCost: spec.unitCost,
              },
            });
          }
          await prisma.inventoryMovement.create({
            data: {
              shopId: shop.id,
              productId: spec.prod.id,
              type: 'PURCHASE',
              quantityChange: spec.qty,
              referenceType: 'PURCHASE',
              referenceId: purchase.id,
            },
          });
        }
      }

      if (!purchase.isOpeningStock && p % 2 === 0) {
        const payAmount = (totalAmount * BigInt(40 + (p % 50))) / 100n;
        if (payAmount > 0n) {
          const sp = await prisma.supplierPayment.create({
            data: {
              shopId: shop.id,
              supplierId: supplier.id,
              purchaseId: purchase.id,
              amount: payAmount,
              paymentDate: purchaseDate,
              ...cancelledFields(p % 5 === 0, owner.id),
              notes: pick(SUPPLIER_PAYMENT_NOTES, p),
              createdById: owner.id,
            },
          });
          await prisma.cashMovement.create({
            data: {
              shopId: shop.id,
              type: 'SUPPLIER_PAYMENT',
              direction: 'OUT',
              amount: payAmount,
              movementDate: daysAgo(70 - (p % 65)),
              referenceType: 'SUPPLIER_PAYMENT',
              referenceId: sp.id,
              note: `${pick(SUPPLIER_PAYMENT_NOTES, p)} — ${supplier.name} / ${purchaseNo}`,
              createdById: owner.id,
            },
          });
        }
      }
    }
  }

  if (inStockUnits.length === 0) {
    const units = await prisma.inventoryUnit.findMany({
      where: { shopId: shop.id, status: 'IN_STOCK' },
      take: 200,
      orderBy: { createdAt: 'asc' },
    });
    for (const u of units) {
      const prod = products.find((p) => p.id === u.productId);
      inStockUnits.push({
        ...u,
        sellPrice: prod?.defaultSellingPrice ?? paisa(10000),
      });
    }
  }

  const saleCount = await prisma.sale.count({ where: { shopId: shop.id } });
  let nextSaleNo = saleCount + 1;
  let unitCursor = 0;

  if (saleCount < cfg.salesPerShop) {
    const need = cfg.salesPerShop - saleCount;
    for (let s = 0; s < need; s += 1) {
      const customer = pick(customers, s);
      const saleNo = `S-${String(nextSaleNo).padStart(4, '0')}`;
      nextSaleNo += 1;
      const saleDate = daysAgo(55 - (s % 50));
      const lines = [];

      const sellUnit = unitCursor < inStockUnits.length && s % 3 !== 2
        ? inStockUnits[unitCursor++]
        : null;

      if (sellUnit) {
        const price =
          sellUnit.askingPrice && sellUnit.askingPrice > 0n
            ? sellUnit.askingPrice
            : sellUnit.sellPrice;
        lines.push({
          productId: sellUnit.productId,
          inventoryUnitId: sellUnit.id,
          quantity: 1,
          unitPrice: price,
          unitCost: sellUnit.unitCost,
          total: price,
          warrantyDays: sellUnit.condition === 'USED' ? pick([1, 2, 3], s) : null,
          kind: 'SERIALIZED',
          unitId: sellUnit.id,
        });
      }

      const qtyProd = pick(quantity.length ? quantity : products, s + 2);
      const qty = 1 + (s % 3);
      const level = await prisma.stockLevel.findUnique({ where: { productId: qtyProd.id } });
      if (level && level.quantityOnHand >= qty) {
        const unitPrice = qtyProd.defaultSellingPrice > 0n ? qtyProd.defaultSellingPrice : paisa(500);
        const unitCost = level.avgUnitCost > 0n ? level.avgUnitCost : paisa(300);
        lines.push({
          productId: qtyProd.id,
          inventoryUnitId: null,
          quantity: qty,
          unitPrice,
          unitCost,
          total: unitPrice * BigInt(qty),
          warrantyDays: null,
          kind: 'QUANTITY',
          unitId: null,
        });
      }

      if (lines.length === 0) continue;

      const subtotal = lines.reduce((acc, l) => acc + l.total, 0n);
      const discount = s % 6 === 0 ? (subtotal * 5n) / 100n : 0n;
      const totalAmount = subtotal - discount;

      const sale = await prisma.sale.create({
        data: {
          shopId: shop.id,
          customerId: customer.id,
          saleNo,
          saleDate,
          subtotal,
          discount,
          totalAmount,
          ...cancelledFields(s % 8 === 0, owner.id),
          clientRequestId: crypto.randomUUID(),
          notes: pick(SALE_NOTES, s),
          createdById: owner.id,
        },
      });

      for (const line of lines) {
        await prisma.saleItem.create({
          data: {
            shopId: shop.id,
            saleId: sale.id,
            productId: line.productId,
            inventoryUnitId: line.inventoryUnitId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            unitCost: line.unitCost,
            total: line.total,
            warrantyDays: line.warrantyDays,
          },
        });

        if (line.kind === 'SERIALIZED' && line.unitId) {
          await prisma.inventoryUnit.update({
            where: { id: line.unitId },
            data: { status: 'SOLD' },
          });
          await prisma.inventoryMovement.create({
            data: {
              shopId: shop.id,
              productId: line.productId,
              inventoryUnitId: line.unitId,
              type: 'SALE',
              quantityChange: -1,
              referenceType: 'SALE',
              referenceId: sale.id,
            },
          });
        } else {
          await prisma.stockLevel.update({
            where: { productId: line.productId },
            data: { quantityOnHand: { decrement: line.quantity } },
          });
          await prisma.inventoryMovement.create({
            data: {
              shopId: shop.id,
              productId: line.productId,
              type: 'SALE',
              quantityChange: -line.quantity,
              referenceType: 'SALE',
              referenceId: sale.id,
            },
          });
        }
      }

      const paidFully = s % 4 !== 3;
      const payAmount = paidFully ? totalAmount : (totalAmount * 60n) / 100n;
      const paymentMethod = PAYMENT_METHODS[s % PAYMENT_METHODS.length];
      if (payAmount > 0n) {
        const payment = await prisma.payment.create({
          data: {
            shopId: shop.id,
            customerId: customer.id,
            saleId: sale.id,
            amount: payAmount,
            paymentDate: saleDate,
            method: paymentMethod,
            ...cancelledFields(s % 5 === 0, owner.id),
            clientRequestId: crypto.randomUUID(),
            notes: pick(CUSTOMER_PAYMENT_NOTES, s),
            createdById: owner.id,
          },
        });
        await prisma.cashMovement.create({
          data: {
            shopId: shop.id,
            type: 'CUSTOMER_PAYMENT',
            direction: 'IN',
            amount: payAmount,
            movementDate: saleDate,
            referenceType: 'PAYMENT',
            referenceId: payment.id,
            note: `Received (${paymentMethod}) from ${customer.name} for ${saleNo}`,
            createdById: owner.id,
          },
        });
      }
    }
  }

  await mixupShopDemoData(prisma, shop.id);
  await seedManualAdjustments(prisma, shop, cfg);

  const expenseCount = await prisma.expense.count({ where: { shopId: shop.id } });
  if (expenseCount < cfg.expensesPerShop && expenseCats.length > 0) {
    const need = cfg.expensesPerShop - expenseCount;
    for (let e = 0; e < need; e += 1) {
      const cat = pick(expenseCats, e);
      const amount = paisa(800 + e * 120 + (e % 7) * 50);
      const expenseDate = dateOnly(daysAgo(40 - (e % 35)));
      const expense = await prisma.expense.create({
        data: {
          shopId: shop.id,
          categoryId: cat.id,
          amount,
          expenseDate,
          description: pick(EXPENSE_NOTES, e),
          ...cancelledFields(e % 6 === 0, owner.id),
          createdById: owner.id,
        },
      });
      await prisma.cashMovement.create({
        data: {
          shopId: shop.id,
          type: 'EXPENSE',
          direction: 'OUT',
          amount,
          movementDate: daysAgo(40 - (e % 35)),
          referenceType: 'EXPENSE',
          referenceId: expense.id,
          note: expense.description,
          createdById: owner.id,
        },
      });
    }
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      nextSaleNo: nextSaleNo,
      nextPurchaseNo: nextPurchaseNo,
    },
  });

  const adjustmentsNow = await prisma.inventoryMovement.count({
    where: {
      shopId: shop.id,
      type: { in: ['ADJUSTMENT', 'DAMAGED', 'LOST'] },
    },
  });

  console.log(
    `  ✓ Shop ${shopIndex + 1}: ${shop.name} | products=${products.length} | customers=${customers.length} | suppliers=${suppliers.length + (walkIn ? 1 : 0)} | adjustments=${adjustmentsNow}`,
  );

  return { shop, owner, skipped: false };
}

/**
 * Seeds ADJUSTMENT / DAMAGED / LOST movements against live stock.
 * QUANTITY: updates stock_levels. SERIALIZED phones: marks units DAMAGED/LOST.
 */
async function seedManualAdjustments(prisma, shop, cfg) {
  const manualAdjustmentCount = await prisma.inventoryMovement.count({
    where: {
      shopId: shop.id,
      type: { in: ['ADJUSTMENT', 'DAMAGED', 'LOST'] },
    },
  });
  if (manualAdjustmentCount >= cfg.adjustmentsPerShop) {
    return manualAdjustmentCount;
  }

  const need = cfg.adjustmentsPerShop - manualAdjustmentCount;
  const qtyLevels = await prisma.stockLevel.findMany({
    where: { shopId: shop.id, quantityOnHand: { gt: 0 } },
    orderBy: { updatedAt: 'asc' },
    take: 80,
  });
  let phoneUnits = await prisma.inventoryUnit.findMany({
    where: { shopId: shop.id, status: 'IN_STOCK' },
    orderBy: { createdAt: 'asc' },
    take: 80,
  });

  for (let a = 0; a < need; a += 1) {
    const kind = a % 3; // 0 ADJUSTMENT, 1 DAMAGED, 2 LOST
    const createdAt = daysAgo(28 - (a % 25));

    if (kind === 0 && qtyLevels.length > 0) {
      const level = pick(qtyLevels, a);
      const delta = a % 2 === 0 ? 1 + (a % 3) : -(1 + (a % 2));
      const nextQty = Math.max(0, level.quantityOnHand + delta);
      const change = nextQty - level.quantityOnHand;
      if (change === 0) continue;

      await prisma.stockLevel.update({
        where: { productId: level.productId },
        data: { quantityOnHand: nextQty },
      });
      level.quantityOnHand = nextQty;
      await prisma.inventoryMovement.create({
        data: {
          shopId: shop.id,
          productId: level.productId,
          type: 'ADJUSTMENT',
          quantityChange: change,
          reason: pick(ADJUSTMENT_REASONS, a),
          createdAt,
        },
      });
      continue;
    }

    if ((kind === 1 || kind === 2) && phoneUnits.length > 0 && a % 2 === 0) {
      const unitIdx = a % phoneUnits.length;
      const unit = phoneUnits[unitIdx];
      if (!unit || unit.status !== 'IN_STOCK') continue;
      const type = kind === 1 ? 'DAMAGED' : 'LOST';
      await prisma.inventoryUnit.update({
        where: { id: unit.id },
        data: { status: type },
      });
      phoneUnits.splice(unitIdx, 1);
      await prisma.inventoryMovement.create({
        data: {
          shopId: shop.id,
          productId: unit.productId,
          inventoryUnitId: unit.id,
          type,
          quantityChange: -1,
          reason: pick(kind === 1 ? DAMAGE_REASONS : LOST_REASONS, a),
          createdAt,
        },
      });
      continue;
    }

    const writable = qtyLevels.filter((l) => l.quantityOnHand > 0);
    if (writable.length === 0) continue;
    const level = pick(writable, a);
    const writeOff = Math.min(level.quantityOnHand, 1 + (a % 3));
    if (writeOff <= 0) continue;
    const type = kind === 2 ? 'LOST' : 'DAMAGED';
    await prisma.stockLevel.update({
      where: { productId: level.productId },
      data: { quantityOnHand: { decrement: writeOff } },
    });
    level.quantityOnHand -= writeOff;
    await prisma.inventoryMovement.create({
      data: {
        shopId: shop.id,
        productId: level.productId,
        type,
        quantityChange: -writeOff,
        reason: pick(type === 'LOST' ? LOST_REASONS : DAMAGE_REASONS, a),
        createdAt,
      },
    });
  }

  return prisma.inventoryMovement.count({
    where: {
      shopId: shop.id,
      type: { in: ['ADJUSTMENT', 'DAMAGED', 'LOST'] },
    },
  });
}

async function seedDemoData(prisma) {
  const cfg = {
    shopCount: envInt('SEED_SHOP_COUNT', 120),
    productsPerCategory: envInt('SEED_PRODUCTS_PER_CATEGORY', 40),
    customersPerShop: envInt('SEED_CUSTOMERS_PER_SHOP', 40),
    suppliersPerShop: envInt('SEED_SUPPLIERS_PER_SHOP', 40),
    purchasesPerShop: envInt('SEED_PURCHASES_PER_SHOP', 48),
    salesPerShop: envInt('SEED_SALES_PER_SHOP', 48),
    adjustmentsPerShop: envInt('SEED_ADJUSTMENTS_PER_SHOP', 36),
    expensesPerShop: envInt('SEED_EXPENSES_PER_SHOP', 40),
  };

  const password = (process.env.SEED_OWNER_PASSWORD || 'admin@123').trim();
  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash(password, 10);

  const firstOwnerPhone = (process.env.SEED_OWNER_PHONE || '03029825214').trim();

  console.log('🏪 Demo seed configuration:');
  console.log(`   shops=${cfg.shopCount} products/category=${cfg.productsPerCategory}`);
  console.log(
    `   customers=${cfg.customersPerShop} suppliers=${cfg.suppliersPerShop} purchases=${cfg.purchasesPerShop} sales=${cfg.salesPerShop} adjustments=${cfg.adjustmentsPerShop} expenses=${cfg.expensesPerShop}`,
  );
  console.log('');

  for (let i = 0; i < cfg.shopCount; i += 1) {
    const place = pick(CITIES, i);
    const ownerRawPhone = i === 0 ? firstOwnerPhone : ownerPhoneLocal(i);
    const shopName =
      i === 0
        ? process.env.SEED_SHOP_NAME || `Ronaq Mobile ${place.city}`
        : `Ronaq Mobile ${place.city} ${String(i + 1).padStart(2, '0')}`;
    const ownerName =
      i === 0
        ? process.env.SEED_OWNER_NAME || 'Shop Owner'
        : `${pick(FIRST_NAMES, i)} ${pick(LAST_NAMES, i)}`;

    console.log(`→ Seeding shop ${i + 1}/${cfg.shopCount}…`);
    await ensureShopBundle(prisma, {
      shopIndex: i,
      ownerName,
      ownerRawPhone,
      passwordHash,
      shopName,
      cfg,
    });
  }

  console.log('');
  console.log('🎉 Demo data seed finished.');
  console.log('──────────────────────────────────────────────────');
  console.log('Primary shop owner login:');
  console.log(`   Phone:    ${firstOwnerPhone}`);
  console.log(`   Password: ${password}`);
  if (cfg.shopCount > 1) {
    console.log(`   Other shops: ${ownerPhoneLocal(1)} … ${ownerPhoneLocal(cfg.shopCount - 1)}`);
    console.log(`   Password: ${password} (same for all demo owners)`);
  }
  console.log('──────────────────────────────────────────────────');
}

module.exports = { seedDemoData, mixupShopDemoData };
