import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShopStatus } from '../../generated/prisma/enums.js';
import type { PlatformShopAccessStatus } from './list-shops-query.dto.js';

export class ResponsePlatformShopDto {
  @ApiProperty({ example: '01924f0a-0000-0000-0000-000000000000' })
  id: string;

  @ApiProperty({ example: 'Khalid Mobile Center' })
  name: string;

  @ApiPropertyOptional({
    example: '923001234567',
    nullable: true,
    description: 'Shop contact phone, if set.',
  })
  phone: string | null;

  @ApiPropertyOptional({
    example: 'Main Bazaar, Lahore',
    nullable: true,
  })
  address: string | null;

  @ApiProperty({
    enum: ShopStatus,
    example: ShopStatus.ACTIVE,
    description: 'Raw DB status: ACTIVE or SUSPENDED.',
  })
  status: ShopStatus;

  @ApiProperty({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'],
    description:
      'Derived access state for the admin UI. SUSPENDED wins over EXPIRED.',
  })
  accessStatus: PlatformShopAccessStatus;

  @ApiProperty({
    example: true,
    description:
      'Whether the owner can work right now: ACTIVE status and subscription not expired.',
  })
  isAccessible: boolean;

  @ApiProperty({ example: '2026-11-05T00:00:00.000Z' })
  subscriptionEndsAt: Date;

  @ApiPropertyOptional({
    example: '01924f0a-0000-0000-0000-000000000001',
    nullable: true,
  })
  ownerId: string | null;

  @ApiPropertyOptional({ example: 'Khalid Mehmood', nullable: true })
  ownerName: string | null;

  @ApiPropertyOptional({ example: '923001234567', nullable: true })
  ownerPhone: string | null;

  @ApiProperty({
    example: false,
    description: 'False until the owner has set a password via the setup link.',
  })
  hasPassword: boolean;

  @ApiPropertyOptional({
    example: 'khalid-mobile-center',
    nullable: true,
    description: 'Public storefront slug, if store settings exist.',
  })
  storeSlug: string | null;

  @ApiProperty({ example: '2026-10-05T09:20:00.000Z' })
  createdAt: Date;
}
