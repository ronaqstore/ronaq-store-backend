import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { tooManyRequests } from '../../errors/error.builder.js';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;
const MAX_SEARCH_REQUESTS = 40;
const MAX_TRACKED_KEYS = 10_000;

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const isSearch = RateLimitGuard.isSearchRequest(request);
    const key = `${request.ip ?? 'unknown'}:${isSearch ? 'search' : 'public'}`;
    const max = isSearch ? MAX_SEARCH_REQUESTS : MAX_REQUESTS;
    const now = Date.now();

    const bucket = RateLimitGuard.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (RateLimitGuard.buckets.size >= MAX_TRACKED_KEYS) {
        RateLimitGuard.sweep(now);
      }
      RateLimitGuard.buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > max) {
      throw new HttpException(tooManyRequests(), HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private static isSearchRequest(request: Request): boolean {
    const path = request.path ?? '';
    if (path.includes('/models')) return true;
    const q = request.query?.q;
    return typeof q === 'string' && q.trim().length > 0;
  }

  private static sweep(now: number): void {
    for (const [key, bucket] of RateLimitGuard.buckets) {
      if (bucket.resetAt <= now) RateLimitGuard.buckets.delete(key);
    }
  }
}
