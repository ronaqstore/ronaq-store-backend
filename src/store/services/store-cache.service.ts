import { Injectable } from '@nestjs/common';
import { ShopStoreSettings } from '../../generated/prisma/client.js';

export type CachedStoreSettings = ShopStoreSettings;

@Injectable()
export class StoreCacheService {
  private readonly ttlMs = 60_000;
  private readonly entries = new Map<
    string,
    { value: CachedStoreSettings; expiresAt: number }
  >();

  get(slug: string): CachedStoreSettings | undefined {
    const entry = this.entries.get(slug);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(slug);
      return undefined;
    }
    return entry.value;
  }

  set(slug: string, value: CachedStoreSettings): void {
    this.entries.set(slug, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
