import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  OptionalSupplierCnicProperty,
  OptionalSupplierPhoneProperty,
} from '../../helpers/supplier-profile.decorators.js';

const IMEI_PATTERN = /^\d{15}$/;

export class CreateConsignmentDto {
  @ApiProperty({
    description: 'Double-tap protection client request UUID.',
    example: '01924f0a-0000-7000-8000-00000000beef',
  })
  @IsUUID()
  clientRequestId: string;

  @ApiPropertyOptional({
    description: 'Existing customer ID if registered in shop.',
    example: '01924f0a-0000-7000-8000-00000000000a',
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({
    description: 'Name of the person leaving the phone on consignment.',
    example: 'Muhammad Ali',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  consignorName: string;

  @OptionalSupplierPhoneProperty('03001234567')
  consignorPhone: string;

  @OptionalSupplierCnicProperty()
  consignorCnic?: string;

  @ApiProperty({
    description: 'The product catalog ID for this mobile phone model.',
    example: '01924f0a-0000-7000-8000-00000000000b',
  })
  @IsUUID()
  productId: string;

  @ApiProperty({
    description: 'Primary IMEI (15 digits).',
    example: '356938035643803',
  })
  @IsString()
  @Matches(IMEI_PATTERN)
  imei1: string;

  @ApiPropertyOptional({
    description: 'Secondary IMEI (15 digits, must differ from imei1).',
    example: '356938035643804',
  })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsOptional()
  @IsString()
  @Matches(IMEI_PATTERN)
  imei2?: string;

  @ApiPropertyOptional({
    description: 'Physical condition of the unit.',
    example: 'USED',
    default: 'USED',
  })
  @IsOptional()
  @IsIn(['NEW', 'USED'])
  condition?: 'NEW' | 'USED';

  @ApiPropertyOptional({
    description: 'iPhone battery health percentage (1-100).',
    example: 85,
  })
  @Transform(({ value }) =>
    value !== '' && value != null ? Number(value) : undefined,
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  batteryHealth?: number;

  @ApiPropertyOptional({
    description: 'Physical or functional defect notes.',
    example: 'Minor scratch on top corner, camera lens clean.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(0, 500)
  defectNotes?: string;

  @ApiProperty({
    description:
      'Agreed payout to the consignor in PAISA upon sale (Rs 50,000 = 5000000).',
    example: 5000000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  agreedPayout: number;

  @ApiPropertyOptional({
    description: 'Target or asking sale price in PAISA (Rs 55,000 = 5500000).',
    example: 5500000,
  })
  @Transform(({ value }) =>
    value !== '' && value != null ? Number(value) : undefined,
  )
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  targetSellingPrice?: number;

  @ApiProperty({
    description: 'Intake date in YYYY-MM-DD.',
    example: '2026-11-01',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  intakeDate: string;

  @ApiPropertyOptional({
    description: 'Internal shop notes about the consignment agreement.',
    example: 'Customer will collect payout within 3 days after sale.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
