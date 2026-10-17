import type { Request } from 'express';
import type {
  AuthenticatedOwner,
  AuthenticatedPlatformAdmin,
} from './auth-token.js';

export type OwnerRequest = Request & {
  user: AuthenticatedOwner;
};

export type PlatformAdminRequest = Request & {
  user: AuthenticatedPlatformAdmin;
};
