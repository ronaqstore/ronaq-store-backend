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

export class ResponseStoreUnitDto {
  @ApiProperty({ example: '01924f0a-0000-7000-8000-0000000000d1' })
  id: string;

  @ApiProperty({
    description: 'Masked IMEI1 for public display (last 4 visible).',
    example: '********5677',
  })
  imeiMasked: string;

  @ApiProperty({ example: 'USED', enum: ['NEW', 'USED'] })
  condition: 'NEW' | 'USED';

  @ApiPropertyOptional({
    description: 'iPhone battery health 1–100.',
    example: 97,
  })
  batteryHealth?: number | null;

  @ApiProperty({
    description:
      'Effective ask price in paisa (unit askingPrice or product default).',
    example: 5200000,
  })
  price: number | null;

  @ApiPropertyOptional({
    description: 'Public-safe defect summary when present.',
    example: 'Water damage',
  })
  defectNotes?: string | null;
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
    description: 'QUANTITY (accessories) or SERIALIZED (phones).',
    enum: ['QUANTITY', 'SERIALIZED'],
    example: 'SERIALIZED',
  })
  trackingType: 'QUANTITY' | 'SERIALIZED';

  @ApiPropertyOptional({
    description:
      'Phone model group key for sibling variants (brand--model). Null on accessories.',
    example: 'apple--iphone-7',
  })
  modelKey?: string | null;

  @ApiProperty({
    description: 'Selling price in paisa. Rs 45,000 = 4500000.',
    example: 4500000,
  })
  price: number | null;

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
  ptaStatus?:
    'PTA_APPROVED' | 'NON_PTA' | 'JV' | 'BYPASS' | 'MDM_BYPASS' | null;

  @ApiPropertyOptional({
    description:
      'ORIGINAL or COPY for accessories (chargers, cables, airpods…). Null for phones.',
    enum: ['ORIGINAL', 'COPY'],
    example: 'ORIGINAL',
  })
  authenticity?: 'ORIGINAL' | 'COPY' | null;

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

  @ApiPropertyOptional({
    description:
      'In-stock phone units for this variant (SERIALIZED). Omitted on list cards / accessories.',
    type: [ResponseStoreUnitDto],
  })
  units?: ResponseStoreUnitDto[];
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

export class ResponseStoreModelDto {
  @ApiProperty({
    description: 'URL key: brandSlug--modelSlug',
    example: 'apple--iphone-7',
  })
  key: string;

  @ApiProperty({ example: 'Apple' })
  brand: string;

  @ApiProperty({ example: 'iPhone 7' })
  model: string;

  @ApiProperty({ description: 'How many published variants under this model.' })
  variantCount: number;

  @ApiPropertyOptional({
    description: 'Cover image from the first variant.',
    example: 'https://cdn.example.com/iphone7.jpg',
  })
  coverImage?: string | null;

  @ApiPropertyOptional({
    description: 'Lowest selling price among variants (paisa).',
    example: 4500000,
  })
  fromPrice?: number | null;

  @ApiProperty({
    description: 'Best availability across variants.',
    example: 'IN_STOCK',
  })
  availability: StoreAvailability;
}

export class ResponseStoreModelDetailDto {
  @ApiProperty({ example: 'apple--iphone-7' })
  key: string;

  @ApiProperty({ example: 'Apple' })
  brand: string;

  @ApiProperty({ example: 'iPhone 7' })
  model: string;

  @ApiProperty({ type: [ResponseStoreProductDto] })
  variants: ResponseStoreProductDto[];
}
