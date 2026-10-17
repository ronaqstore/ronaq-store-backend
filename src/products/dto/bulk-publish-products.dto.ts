import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class BulkPublishProductsDto {
  @ApiProperty({
    description: 'Product ids (1–100). Duplicates are ignored.',
    type: [String],
    example: ['01924f0a-0000-7000-8000-000000000002'],
  })
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  ids: string[];

  @ApiProperty({
    description: 'true = publish, false = unpublish.',
    example: true,
  })
  @IsBoolean()
  isPublished: boolean;
}
