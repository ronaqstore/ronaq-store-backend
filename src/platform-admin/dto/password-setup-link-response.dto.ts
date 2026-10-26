import { ApiProperty } from '@nestjs/swagger';

export class PasswordSetupLinkResponseDto {
  @ApiProperty({ example: '01924f0a-0000-0000-0000-000000000000' })
  shopId: string;

  @ApiProperty({ example: '01924f0a-0000-0000-0000-000000000000' })
  ownerId: string;

  @ApiProperty({ example: 'Khalid Mehmood' })
  ownerName: string;

  @ApiProperty({ example: '923001234567' })
  ownerPhone: string;

  @ApiProperty({
    example:
      'https://admin.example.com/setup-password?token=9f2c1a4b7e6d5c8a0b1f2e3d4c5b6a79887766554433221100ffeeddccbbaa99',
    description:
      'One-time secure link built from APP_BASE_URL (local or Vercel). Send on WhatsApp. Previous unused links for this owner are invalidated.',
  })
  setupUrl: string;

  @ApiProperty({
    example: '2026-10-27T09:20:00.000Z',
    description: 'When this link stops working if unused.',
  })
  setupLinkExpiresAt: Date;
}
