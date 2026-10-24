import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResponseMarketplaceModelDto {
  @ApiProperty({ example: 'apple--iphone-7' })
  modelKey: string;

  @ApiProperty({ example: 'Apple' })
  brand: string;

  @ApiProperty({ example: 'iPhone 7' })
  model: string;

  @ApiProperty({ example: 'Apple iPhone 7' })
  title: string;

  @ApiProperty({
    example: 12,
    description: 'Listings across shops for this model',
  })
  count: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/iphone-7.jpg' })
  imageUrl: string | null;

  @ApiPropertyOptional({
    example: 2850000,
    description: 'Lowest listing price in paisa',
  })
  minPrice: number | null;
}
