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
const MAX_REQUESTS = 20;
const MAX_TRACKED_KEYS = 5_000;

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private static readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = `${request.ip ?? 'unknown'}:${request.path}`;
    const now = Date.now();

    const bucket = AuthRateLimitGuard.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (AuthRateLimitGuard.buckets.size >= MAX_TRACKED_KEYS) {
        AuthRateLimitGuard.sweep(now);
      }
      AuthRateLimitGuard.buckets.set(key, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      throw new HttpException(tooManyRequests(), HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private static sweep(now: number): void {
    for (const [key, bucket] of AuthRateLimitGuard.buckets) {
      if (bucket.resetAt <= now) AuthRateLimitGuard.buckets.delete(key);
    }
  }
}
