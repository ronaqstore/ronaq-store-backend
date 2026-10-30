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
  ValidateIf,
} from 'class-validator';

export class ProductOptionalSpecFieldsDto {
  @ApiPropertyOptional({ example: 'SM-A155F', nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @ApiPropertyOptional({ example: 'Blue', nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string | null;

  @ApiPropertyOptional({ example: '8GB', nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ram?: string | null;

  @ApiPropertyOptional({ example: '128GB', nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(50)
  storage?: string | null;

  @ApiPropertyOptional({ example: 'A15-BLU-128', nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString()
  @Length(1, 100)
  sku?: string | null;

  @ApiPropertyOptional({ example: '356938035643809', nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString()
  @Length(1, 100)
  barcode?: string | null;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.example.com/a15.jpg',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'imageUrl must be a valid URL' })
  @MaxLength(500)
  imageUrl?: string | null;

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
      'PTA status shown to customers. null clears it (accessories have none). ' +
      'Android: PTA_APPROVED | NON_PTA. iPhone may also use JV | BYPASS | MDM_BYPASS.',
    enum: ['PTA_APPROVED', 'NON_PTA', 'JV', 'BYPASS', 'MDM_BYPASS'],
    example: 'PTA_APPROVED',
  })
  @IsOptional()
  @IsIn(['PTA_APPROVED', 'NON_PTA', 'JV', 'BYPASS', 'MDM_BYPASS'])
  ptaStatus?:
    'PTA_APPROVED' | 'NON_PTA' | 'JV' | 'BYPASS' | 'MDM_BYPASS' | null;

  @ApiPropertyOptional({
    description:
      'ORIGINAL or COPY for QUANTITY accessories (chargers, cables, airpods, covers, mic…). ' +
      'null for phones or to clear. Shown on the public store.',
    enum: ['ORIGINAL', 'COPY'],
    example: 'ORIGINAL',
  })
  @IsOptional()
  @IsIn(['ORIGINAL', 'COPY'])
  authenticity?: 'ORIGINAL' | 'COPY' | null;
}
