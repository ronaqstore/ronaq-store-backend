import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ShopStatus,
  SubscriptionStatus,
} from '../../generated/prisma/enums.js';

export class UpdateSubscriptionResponseDto {
  @ApiProperty({ example: '01924f0a-0000-0000-0000-000000000000' })
  shopId: string;

  @ApiProperty({ example: 'Khalid Mobile Center' })
  shopName: string;

  @ApiProperty({ enum: ShopStatus, example: ShopStatus.ACTIVE })
  status: ShopStatus;

  @ApiProperty({
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  subscriptionStatus: SubscriptionStatus;

  @ApiPropertyOptional({
    example: '2026-11-05T00:00:00.000Z',
    nullable: true,
  })
  trialEndsAt?: Date | null;

  @ApiProperty({ example: '2026-12-05T00:00:00.000Z' })
  subscriptionEndsAt: Date;

  @ApiProperty({
    example: true,
    description:
      'Whether the shop can work right now: status ACTIVE and the subscription has not expired.',
  })
  isAccessible: boolean;
}
