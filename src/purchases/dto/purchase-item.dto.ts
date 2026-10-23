import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PurchasePhoneUnitDto } from './purchase-phone-unit.dto.js';

const PHONE_UNIT_COUNT_MAX = 50_000;

export class PurchaseItemDto {
  @ApiProperty({
    description:
      'Product bought on this line. Must belong to the shop in the JWT.',
    example: '01924f0a-0000-7000-8000-000000000101',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description:
      'How many were bought. More than 0. For SERIALIZED products this must equal phoneUnits.length.',
    example: 2,
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity: number;

  @ApiProperty({
    description:
      'Cost of ONE unit in PAISA (Rs 500 = 50000). Server multiplies it out; totalAmount is never accepted from the client.',
    example: 50000,
  })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  unitCost: number;

  @ApiPropertyOptional({
    description:
      'SERIALIZED products only. One entry per physical phone (IMEI1 + IMEI2). Length must equal quantity.',
    type: [PurchasePhoneUnitDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(PHONE_UNIT_COUNT_MAX)
  @ValidateNested({ each: true })
  @Type(() => PurchasePhoneUnitDto)
  phoneUnits?: PurchasePhoneUnitDto[];

  @ApiPropertyOptional({
    description:
      'Default condition for phoneUnits that omit their own condition.',
    example: 'NEW',
    default: 'NEW',
  })
  @IsOptional()
  @IsIn(['NEW', 'USED'])
  condition?: 'NEW' | 'USED';
}
