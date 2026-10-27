import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class DashboardCacheService {
  private readonly logger = new Logger(DashboardCacheService.name);
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries = 1000;

  get<T>(key: string): T | undefined {
    try {
      const entry = this.entries.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        this.entries.delete(key);
        return undefined;
      }
      return entry.value as T;
    } catch (error) {
      this.logger.warn(`Cache read failed for key ${key}: ${String(error)}`);
      return undefined;
    }
  }

  set<T>(key: string, value: T, ttlSeconds = 60): void {
    try {
      if (this.entries.size >= this.maxEntries) {
        this.prune();
      }
      this.entries.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    } catch (error) {
      this.logger.warn(`Cache write failed for key ${key}: ${String(error)}`);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
      }
    }
    if (this.entries.size >= this.maxEntries) {
      const keysToDelete = Array.from(this.entries.keys()).slice(0, 200);
      for (const k of keysToDelete) {
        this.entries.delete(k);
      }
    }
  }
}
