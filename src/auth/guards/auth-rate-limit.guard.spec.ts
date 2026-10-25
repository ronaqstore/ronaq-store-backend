import { HttpException } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

describe('AuthRateLimitGuard', () => {
  const guard = new AuthRateLimitGuard();

  function mockContext(path: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: 'auth-test-ip',
          path,
        }),
      }),
    };
  }

  it('blocks after 20 attempts per path per minute', () => {
    const ctx = mockContext('/auth/login');
    for (let i = 0; i < 20; i += 1) {
      expect(guard.canActivate(ctx as never)).toBe(true);
    }
    expect(() => guard.canActivate(ctx as never)).toThrow(HttpException);
  });
});
