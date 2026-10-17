import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/enums.js';
import { invalidToken } from '../errors/error.builder.js';

export enum AuthTokenType {
  OWNER = 'OWNER',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}

export interface JwtPayloadClaims {
  sub: string;
  typ: AuthTokenType;

  shopId?: string | null;
  role?: UserRole;
}

export interface AuthenticatedOwner {
  userId: string;
  shopId: string;
  role: UserRole;
}

export interface AuthenticatedPlatformAdmin {
  adminId: string;
  name: string;
}

export const extractBearerToken = (header: string | undefined): string => {
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedException(invalidToken());
  }

  const token = header.slice('Bearer '.length).trim();

  if (!token) {
    throw new UnauthorizedException(invalidToken());
  }

  return token;
};

export const verifyTokenOfType = async (
  jwtService: JwtService,
  secret: string,
  header: string | undefined,
  expectedType: AuthTokenType,
): Promise<JwtPayloadClaims> => {
  const token = extractBearerToken(header);

  let payload: JwtPayloadClaims;

  try {
    payload = await jwtService.verifyAsync<JwtPayloadClaims>(token, {
      secret,
    });
  } catch {
    throw new UnauthorizedException(invalidToken());
  }

  if (
    !payload?.sub ||
    payload.typ !== expectedType ||
    (expectedType === AuthTokenType.OWNER && !payload.shopId)
  ) {
    throw new UnauthorizedException(invalidToken());
  }

  return payload;
};
