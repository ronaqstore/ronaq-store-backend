import { ApiProperty } from '@nestjs/swagger';

export class ResponseBrandDto {
  @ApiProperty({
    description: 'UUID v7 of this brand row.',
    example: '01924f0a-0000-0000-0000-000000000000',
  })
  id: string;

  @ApiProperty({
    description: 'Shop that owns this brand. Every brand is scoped per-tenant.',
    example: '01924f0a-0000-0000-0000-000000000000',
  })
  shopId: string;

  @ApiProperty({ example: 'Samsung' })
  name: string;

  @ApiProperty({
    example: true,
    description: 'Deactivated brands are hidden from dropdowns.',
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Row creation timestamp, UTC.',
    example: '2026-10-05T09:20:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last edit timestamp, UTC.',
    example: '2026-10-05T09:20:00.000Z',
  })
  updatedAt: Date;
}
