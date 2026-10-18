import type { AuthTokenType } from '../../auth-guards/auth-token.js';

export type SignTokenClaims = {
  sub: string;
  typ: AuthTokenType;
  shopId?: string;
  role?: string;
};
