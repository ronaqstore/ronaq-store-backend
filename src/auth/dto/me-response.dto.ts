import { ApiProperty } from '@nestjs/swagger';
import {
  ShopStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma/enums.js';

export class MeShopDto {
  @ApiProperty({ example: '01924f0a-0000-0000-0000-000000000000' })
  id: string;

  @ApiProperty({ example: 'Al-Madina Mobile' })
  name: string;

  @ApiProperty({ enum: ShopStatus, example: ShopStatus.ACTIVE })
  shopStatus: ShopStatus;

  @ApiProperty({
    example: '2026-11-05T09:20:00.000Z',
    description: 'Subscription expiry. Requests are blocked once this passes.',
  })
  subscriptionEndsAt: Date;
}

export class MeResponseDto {
  @ApiProperty({ example: '01924f0a-0000-0000-0000-000000000000' })
  id: string;

  @ApiProperty({ example: 'Ali Khan' })
  name: string;

  @ApiProperty({ example: '923001234567' })
  phone: string;

  @ApiProperty({ enum: UserRole, example: UserRole.OWNER })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ description: 'Shop this account belongs to.' })
  shop: MeShopDto;
}
