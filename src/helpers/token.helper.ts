import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;
const HEX_TOKEN_LENGTH = TOKEN_BYTES * 2;

export const isWellFormedToken = (token: string | null | undefined): boolean =>
  typeof token === 'string' &&
  new RegExp(`^[a-f0-9]{${HEX_TOKEN_LENGTH}}$`).test(token);

export const generateOpaqueToken = (): string =>
  randomBytes(TOKEN_BYTES).toString('hex');

export const hashOpaqueToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const hashesMatch = (
  storedHash: string,
  candidateHash: string,
): boolean => {
  const stored = Buffer.from(storedHash, 'hex');
  const candidate = Buffer.from(candidateHash, 'hex');

  if (stored.length !== candidate.length || stored.length === 0) {
    return false;
  }

  return timingSafeEqual(stored, candidate);
};
