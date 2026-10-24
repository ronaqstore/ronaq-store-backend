import { HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard.js';

describe('RateLimitGuard', () => {
  const guard = new RateLimitGuard();

  function mockContext(path: string, query: Record<string, string> = {}) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: `test-${path}-${JSON.stringify(query)}`,
          path,
          query,
        }),
      }),
    };
  }

  it('allows normal public traffic under the global cap', () => {
    const ctx = mockContext('/public/marketplace/hubs');
    for (let i = 0; i < 100; i += 1) {
      expect(guard.canActivate(ctx as never)).toBe(true);
    }
    expect(() => guard.canActivate(ctx as never)).toThrow(HttpException);
  });

  it('applies a stricter cap to search and models traffic', () => {
    const ctx = mockContext('/public/marketplace/models', { q: 'iphone' });
    for (let i = 0; i < 40; i += 1) {
      expect(guard.canActivate(ctx as never)).toBe(true);
    }
    expect(() => guard.canActivate(ctx as never)).toThrow(HttpException);
  });
});
