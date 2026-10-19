import { Prisma } from '../../generated/prisma/client.js';
import {
  ResponseStoreDto,
  ResponseStoreProductDto,
  ResponseStoreUnitDto,
  StoreAvailability,
} from '../dto/response-storefront.dto.js';
import { StoreProductsQueryDto } from '../dto/store-products-query.dto.js';
import type { StorefrontSettingsProfile } from '../services/storefront.service.types.js';
import { toModelKey } from '../../helpers/slug.helper.js';

export const STOREFRONT_SELLABLE_STATUS = 'IN_STOCK';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StorefrontProductRow = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true } };
    brand: { select: { id: true; name: true } };
    stockLevel: { select: { quantityOnHand: true } };
    _count: {
      select: {
        inventoryUnits: {
          where: { status: typeof STOREFRONT_SELLABLE_STATUS };
        };
      };
    };
    images: { select: { url: true; sortOrder: true } };
  };
}>;

export const STOREFRONT_PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  stockLevel: { select: { quantityOnHand: true } },
  _count: {
    select: {
      inventoryUnits: { where: { status: STOREFRONT_SELLABLE_STATUS } },
    },
  },
  images: {
    select: { url: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

export function storefrontAvailability(
  quantityOnHand: number,
  lowStockThreshold: number,
): StoreAvailability {
  if (quantityOnHand <= 0) return 'OUT_OF_STOCK';
  if (quantityOnHand <= lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export function maskStorefrontImei(imei: string): string {
  if (imei.length <= 4) return '****';
  return `${'*'.repeat(Math.max(4, imei.length - 4))}${imei.slice(-4)}`;
}

export function toStorefrontProfile(
  settings: StorefrontSettingsProfile,
): ResponseStoreDto {
  return {
    id: settings.id,
    slug: settings.slug,
    displayName: settings.displayName,
    about: settings.about,
    logoUrl: settings.logoUrl,
    bannerUrl: settings.bannerUrl,
    whatsappNumber: settings.whatsappNumber,
    phoneNumber: settings.phoneNumber,
    address: settings.address,
    city: settings.city,
    googleMapsUrl: settings.googleMapsUrl,
    openingHours: settings.openingHours,
    facebookUrl: settings.facebookUrl,
    instagramUrl: settings.instagramUrl,
  };
}

export function storefrontCatalogWhere(
  shopId: string,
  query?: Pick<StoreProductsQueryDto, 'q' | 'category' | 'brand' | 'inStock'>,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    shopId,
    isActive: true,
    isPublished: true,
    publishedAt: { not: null },
  };
  if (query?.q) {
    const term = query.q;
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { sku: { contains: term, mode: 'insensitive' } },
      { brand: { name: { contains: term, mode: 'insensitive' } } },
    ];
  }
  if (query?.category) {
    where.category = UUID_RE.test(query.category)
      ? { id: query.category }
      : { name: { equals: query.category, mode: 'insensitive' } };
  }
  if (query?.brand) {
    where.brand = UUID_RE.test(query.brand)
      ? { id: query.brand }
      : { name: { equals: query.brand, mode: 'insensitive' } };
  }
  if (query?.inStock === true) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          {
            trackingType: 'QUANTITY',
            stockLevel: { quantityOnHand: { gt: 0 } },
          },
          {
            trackingType: 'SERIALIZED',
            inventoryUnits: { some: { status: STOREFRONT_SELLABLE_STATUS } },
          },
        ],
      },
    ];
  }
  return where;
}

export function toStorefrontProduct(
  row: StorefrontProductRow,
  showExactStock: boolean,
): ResponseStoreProductDto {
  const quantityOnHand =
    row.trackingType === 'QUANTITY'
      ? (row.stockLevel?.quantityOnHand ?? 0)
      : row._count.inventoryUnits;

  const modelLabel = (row.model?.trim() || row.name).trim();
  return {
    id: row.id,
    name: row.name,
    brand: row.brand.name,
    category: row.category.name,
    trackingType: row.trackingType,
    modelKey:
      row.trackingType === 'SERIALIZED'
        ? toModelKey(row.brand.name, modelLabel)
        : null,
    price: row.contactForPrice ? null : Number(row.defaultSellingPrice),
    contactForPrice: row.contactForPrice,
    availability: storefrontAvailability(quantityOnHand, row.lowStockThreshold),
    stockCount: showExactStock ? quantityOnHand : null,
    ptaStatus: row.ptaStatus,
    authenticity: row.authenticity,
    images: [...row.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => image.url),
    description: row.publicDescription,
    specs: {
      model: row.model ?? null,
      color: row.color ?? null,
      ram: row.ram ?? null,
      storage: row.storage ?? null,
    },
  };
}

export type StorefrontUnitRowInput = {
  id: string;
  imei1: string;
  condition: string;
  batteryHealth: number | null;
  askingPrice: unknown;
  defectNotes: string | null;
  defaultPrice: number;
  contactForPrice: boolean;
};

export function mapStorefrontUnitRow(
  input: StorefrontUnitRowInput,
): ResponseStoreUnitDto {
  const ask = input.askingPrice != null ? Number(input.askingPrice) : null;
  const price = input.contactForPrice
    ? null
    : (ask ?? input.defaultPrice ?? null);
  return {
    id: input.id,
    imeiMasked: maskStorefrontImei(input.imei1),
    condition: input.condition as 'NEW' | 'USED',
    batteryHealth: input.batteryHealth,
    price,
    defectNotes: input.defectNotes,
  };
}

export function applyUnitMinPrice(
  product: ResponseStoreProductDto,
  contactForPrice: boolean,
): void {
  const unitPrices = (product.units ?? [])
    .map((u) => u.price)
    .filter((p): p is number => typeof p === 'number');
  if (unitPrices.length > 0 && !contactForPrice) {
    product.price = Math.min(...unitPrices);
  }
}
