import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StorePublicProfileFieldsDto } from './store-public-profile-fields.dto.js';

export type StoreAvailability = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export class StoreSpecsDto {
  @ApiPropertyOptional({ example: 'SM-A155F' })
  model: string | null;

  @ApiPropertyOptional({ example: 'Blue' })
  color: string | null;

  @ApiPropertyOptional({ example: '6GB' })
  ram: string | null;

  @ApiPropertyOptional({ example: '128GB' })
  storage: string | null;
}

export class ResponseStoreProductDto {
  @ApiProperty({
    description: 'Product id.',
    example: '01924f0a-0000-7000-8000-000000000002',
  })
  id: string;

  @ApiProperty({ description: 'Product name.', example: 'Samsung A15' })
  name: string;

  @ApiProperty({ description: 'Brand name.', example: 'Samsung' })
  brand: string;

  @ApiProperty({ description: 'Category name.', example: 'Mobile Phones' })
  category: string;

  @ApiProperty({
    description:
      'Selling price in paisa, or null when contactForPrice is true. Rs 45,000 = 4500000.',
    example: 4500000,
  })
  price: number | null;

  @ApiProperty({
    description: 'true = customers must message the owner to learn the price.',
    example: false,
  })
  contactForPrice: boolean;

  @ApiProperty({
    description: 'IN_STOCK | LOW_STOCK | OUT_OF_STOCK.',
    example: 'LOW_STOCK',
  })
  availability: StoreAvailability;

  @ApiProperty({
    description:
      'Exact number on hand — null unless the owner turned on showExactStock.',
    example: null,
  })
  stockCount: number | null;

  @ApiPropertyOptional({
    description: 'PTA status for phones; null on accessories or when unknown.',
    enum: ['PTA_APPROVED', 'NON_PTA'],
    example: 'PTA_APPROVED',
  })
  ptaStatus?: 'PTA_APPROVED' | 'NON_PTA' | null;

  @ApiProperty({
    description: 'Image URLs sorted by sortOrder — index 0 is the cover.',
    type: [String],
    example: ['https://cdn.example.com/a15-1.jpg'],
  })
  images: string[];

  @ApiPropertyOptional({
    description:
      'The PUBLIC description. The private product description is never returned.',
    example: 'Brand new, box pack, 1 year warranty.',
  })
  description?: string | null;

  @ApiProperty({ type: () => StoreSpecsDto })
  specs: StoreSpecsDto;
}

export class ResponseStoreDto extends StorePublicProfileFieldsDto {
  @ApiPropertyOptional({ description: 'Store settings identifier.' })
  id?: string;

  @ApiProperty({ description: 'Store address.', example: 'khalid-mobile' })
  slug: string;

  @ApiProperty({ description: 'Store name.', example: 'Khalid Mobile Center' })
  displayName: string;
}

export class StoreFilterOptionDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-000000000010' })
  id: string;

  @ApiProperty({ example: 'Mobile Phones' })
  name: string;
}

export class ResponseStoreCategoriesDto {
  @ApiProperty({ type: [StoreFilterOptionDto] })
  categories: StoreFilterOptionDto[];

  @ApiProperty({ type: [StoreFilterOptionDto] })
  brands: StoreFilterOptionDto[];
}

export class ResponseStoreListItemDto extends ResponseStoreDto {
  @ApiPropertyOptional({
    description: 'Count of active and published products in this store.',
    example: 45,
  })
  totalProducts?: number;
}
