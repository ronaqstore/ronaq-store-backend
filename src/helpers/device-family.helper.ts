import type { PtaStatus } from '../generated/prisma/enums.js';

const APPLE_PTA: readonly PtaStatus[] = [
  'PTA_APPROVED',
  'NON_PTA',
  'JV',
  'BYPASS',
  'MDM_BYPASS',
] as const;

const ANDROID_PTA: readonly PtaStatus[] = ['PTA_APPROVED', 'NON_PTA'] as const;

export function isAppleBrandName(
  brandName: string | null | undefined,
): boolean {
  return (brandName ?? '').trim().toLowerCase() === 'apple';
}

export function allowedPtaStatusesForBrand(
  brandName: string | null | undefined,
): readonly PtaStatus[] {
  return isAppleBrandName(brandName) ? APPLE_PTA : ANDROID_PTA;
}

export function isPtaAllowedForBrand(
  brandName: string | null | undefined,
  ptaStatus: string | null | undefined,
): boolean {
  if (ptaStatus == null || ptaStatus === '') return true;
  return (allowedPtaStatusesForBrand(brandName) as readonly string[]).includes(
    ptaStatus,
  );
}
