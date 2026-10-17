import { ApiProperty } from '@nestjs/swagger';

export class ResponseProductImageDto {
  @ApiProperty({
    description: 'UUID v7 of this product_images row.',
    example: '01924f0a-0000-7000-8000-000000000010',
  })
  id: string;

  @ApiProperty({
    description: 'Public https URL of the stored photo.',
    example: 'https://example.com/products-images/a15-front.jpg',
  })
  url: string;

  @ApiProperty({
    description: 'Position on the store. 0 is the cover photo.',
    example: 0,
  })
  sortOrder: number;
}

export class ResponseProductImagesDto {
  @ApiProperty({
    type: [ResponseProductImageDto],
    description: 'Saved photos, lowest sortOrder first (index 0 = cover).',
  })
  items: ResponseProductImageDto[];
}
