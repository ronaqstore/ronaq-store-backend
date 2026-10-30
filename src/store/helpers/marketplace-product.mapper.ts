import { Prisma } from '../../generated/prisma/client.js';
import { toLocalPkPhone } from '../../helpers/phone.helper.js';
import { toModelKey } from '../../helpers/slug.helper.js';
import {
  STOREFRONT_PRODUCT_INCLUDE,
  storefrontAvailability,
  toStorefrontProduct,
} from './storefront.mapper.js';
import type { MarketplaceHubDefinition } from '../constants/marketplace-hubs.constant.js';
import type {
  ResponseMarketplaceHubDto,
  ResponseMarketplaceProductDto,
} from '../dto/response-marketplace.dto.js';
import type { MarketplaceProductSearchRow } from './marketplace-product-search.helper.js';

export const MARKETPLACE_PRODUCT_INCLUDE = {
  ...STOREFRONT_PRODUCT_INCLUDE,
  shop: {
    select: {
      storeSettings: {
        select: {
          slug: true,
          displayName: true,
          city: true,
          whatsappNumber: true,
          showExactStock: true,
        },
      },
    },
  },
} as const;

export type MarketplaceProductPayload = Prisma.ProductGetPayload<{
  include: typeof MARKETPLACE_PRODUCT_INCLUDE;
}>;

export function toHubDto(
  hub: MarketplaceHubDefinition,
): ResponseMarketplaceHubDto {
  return {
    id: hub.id,
    name: hub.name,
    latitude: hub.latitude,
    longitude: hub.longitude,
  };
}

export function toMarketplaceProduct(
  row: MarketplaceProductPayload,
): ResponseMarketplaceProductDto {
  const settings = row.shop.storeSettings;
  const product = toStorefrontProduct(row, settings?.showExactStock ?? false);
  return {
    ...product,
    shop: {
      slug: settings?.slug ?? '',
      displayName: settings?.displayName ?? '',
      city: settings?.city ?? null,
      whatsappNumber:
        toLocalPkPhone(settings?.whatsappNumber) ??
        settings?.whatsappNumber ??
        null,
    },
  };
}

export function toLeanMarketplaceProduct(
  row: MarketplaceProductSearchRow,
): ResponseMarketplaceProductDto {
  const quantityOnHand = Number(row.qty) || 0;
  const modelLabel = (row.model?.trim() || row.name).trim();
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    trackingType: row.tracking_type,
    modelKey:
      row.tracking_type === 'SERIALIZED'
        ? toModelKey(row.brand, modelLabel)
        : null,
    price: Number(row.default_selling_price),
    availability: storefrontAvailability(
      quantityOnHand,
      row.low_stock_threshold,
    ),
    stockCount: row.show_exact_stock ? quantityOnHand : null,
    ptaStatus: row.pta_status as ResponseMarketplaceProductDto['ptaStatus'],
    authenticity:
      row.authenticity as ResponseMarketplaceProductDto['authenticity'],
    images: row.image_url ? [row.image_url] : [],
    description: row.public_description,
    specs: {
      model: row.model ?? null,
      color: row.color ?? null,
      ram: row.ram ?? null,
      storage: row.storage ?? null,
    },
    shop: {
      slug: row.slug ?? '',
      displayName: row.display_name ?? '',
      city: row.city ?? null,
      whatsappNumber:
        toLocalPkPhone(row.whatsapp_number) ?? row.whatsapp_number ?? null,
    },
  };
}
