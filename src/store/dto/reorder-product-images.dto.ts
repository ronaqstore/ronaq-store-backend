import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderProductImagesDto {
  @ApiProperty({
    description:
      'Every image id of this product, in the new desired order (first = cover).',
    example: [
      '01924f0a-0000-7000-8000-000000000010',
      '01924f0a-0000-7000-8000-000000000009',
    ],
    type: 'array',
    items: { type: 'string' },
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(7, { each: true })
  imageIds: string[];
}
