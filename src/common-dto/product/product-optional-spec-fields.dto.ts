import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

export class ProductOptionalSpecFieldsDto {
  @ApiPropertyOptional({ example: 'SM-A155F' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ example: 'Blue' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({ example: '8GB' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ram?: string;

  @ApiPropertyOptional({ example: '128GB' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  storage?: string;

  @ApiPropertyOptional({ example: 'A15-BLU-128' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @ApiPropertyOptional({ example: '356938035643809' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  barcode?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/a15.jpg',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'imageUrl must be a valid URL' })
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({
    description:
      'Publish / unpublish on the public store. Only an ACTIVE product can be published; the DB trigger maintains publishedAt.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({
    description:
      'What customers read on the store. The private `description` field is never shown publicly. Blank clears it.',
    example: 'Brand new, box pack, 1 year warranty.',
    maxLength: 4000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  publicDescription?: string | null;

  @ApiPropertyOptional({
    description:
      'true hides the selling price on the store and shows "Contact for price" instead.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  contactForPrice?: boolean;

  @ApiPropertyOptional({
    description:
      'PTA status shown to customers. null clears it (accessories have none).',
    enum: ['PTA_APPROVED', 'NON_PTA'],
    example: 'PTA_APPROVED',
  })
  @IsOptional()
  @IsIn(['PTA_APPROVED', 'NON_PTA'])
  ptaStatus?: 'PTA_APPROVED' | 'NON_PTA' | null;
}
