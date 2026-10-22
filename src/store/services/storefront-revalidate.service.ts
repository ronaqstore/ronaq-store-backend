import { Injectable, Logger } from '@nestjs/common';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StoreCacheService } from './store-cache.service.js';
import type {
  StorefrontRevalidatePayload,
  StorefrontRevalidateShopRef,
} from './storefront-revalidate.service.types.js';

@Injectable()
export class StorefrontRevalidateService {
  private readonly logger = new Logger(StorefrontRevalidateService.name);

  constructor(
    private readonly config: AppConfigurationService,
    private readonly prisma: PrismaService,
    private readonly storeCache: StoreCacheService,
  ) {}

  invalidateStoresDirectory(): void {
    void this.postTags(['stores']);
  }

  invalidateShopById(shopId: string): void {
    void this.invalidateShopRef({ shopId });
  }

  async invalidateShopRef(ref: StorefrontRevalidateShopRef): Promise<void> {
    const slug = ref.slug?.trim() || (await this.resolveSlug(ref.shopId));
    if (!slug) {
      this.invalidateStoresDirectory();
      return;
    }
    this.storeCache.clear();
    await this.postTags(['stores', `store:${slug}`, `store-products:${slug}`]);
  }

  private async resolveSlug(shopId: string): Promise<string | null> {
    const settings = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
      select: { slug: true },
    });
    return settings?.slug ?? null;
  }

  private async postTags(tags: string[]): Promise<void> {
    const url = this.config.storefrontRevalidateUrl;
    const secret = this.config.storefrontRevalidateSecret;
    if (!url || !secret || tags.length === 0) {
      return;
    }

    const payload: StorefrontRevalidatePayload = { tags, secret };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        this.logger.warn(
          `Storefront revalidate failed (${response.status}) for tags=${tags.join(',')}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Storefront revalidate request error for tags=${tags.join(',')}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
