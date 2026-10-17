import { ApiProperty } from '@nestjs/swagger';
import { StorePublicProfileFieldsDto } from './store-public-profile-fields.dto.js';

export class ResponseStoreSettingsDto extends StorePublicProfileFieldsDto {
  @ApiProperty({
    description:
      'The shop this settings row belongs to (same as the JWT shop).',
    example: '01924f0a-0000-7000-8000-000000000000',
  })
  shopId: string;

  @ApiProperty({
    description: 'Store address, unique across all of Ronaq Store.',
    example: 'khalid-mobile',
  })
  slug: string;

  @ApiProperty({
    description:
      'Master switch. The public store 404s until the owner turns this on.',
    example: false,
  })
  isEnabled: boolean;

  @ApiProperty({ description: 'Store name shown on the storefront.' })
  displayName: string;

  @ApiProperty({
    description:
      'false = storefront says only "In stock / Low / Out"; true = exact number.',
    example: false,
  })
  showExactStock: boolean;

  @ApiProperty({ description: 'Row creation timestamp, UTC.' })
  createdAt: Date;

  @ApiProperty({ description: 'Last edit timestamp, UTC.' })
  updatedAt: Date;
}
