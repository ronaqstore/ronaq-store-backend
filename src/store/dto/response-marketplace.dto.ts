import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResponseStoreProductDto } from './response-storefront.dto.js';

export class ResponseMarketplaceHubDto {
  @ApiProperty({ example: 'timergara' })
  id: string;

  @ApiProperty({ example: 'Timergara' })
  name: string;

  @ApiProperty({ example: 34.8266 })
  latitude: number;

  @ApiProperty({ example: 71.8441 })
  longitude: number;
}

export class ResponseMarketplaceShopSummaryDto {
  @ApiProperty({ example: 'ronaq-mobile-timergara' })
  slug: string;

  @ApiProperty({ example: 'Ronaq Mobile Timergara' })
  displayName: string;

  @ApiPropertyOptional({ example: 'Timergara' })
  city: string | null;

  @ApiPropertyOptional({ example: '03001234567' })
  whatsappNumber: string | null;
}

export class ResponseMarketplaceProductDto extends ResponseStoreProductDto {
  @ApiProperty({ type: ResponseMarketplaceShopSummaryDto })
  shop: ResponseMarketplaceShopSummaryDto;
}
