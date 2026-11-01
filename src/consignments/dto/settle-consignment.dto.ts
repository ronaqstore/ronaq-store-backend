import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/enums.js';

export class SettleConsignmentDto {
  @ApiProperty({
    description: 'Double-tap protection client request UUID.',
    example: '01924f0a-0000-7000-8000-00000000beef',
  })
  @IsUUID()
  clientRequestId: string;

  @ApiProperty({
    description: 'Method used to disburse payout to owner.',
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod)
  payoutMethod: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Reference number for bank transfer or mobile wallet.',
    example: 'TXN-9842718',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(1, 100)
  payoutReference?: string;

  @ApiPropertyOptional({
    description: 'Disbursed amount in PAISA. If omitted, uses agreedPayout.',
    example: 5000000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  settledAmount?: number;

  @ApiPropertyOptional({
    description: 'Confirm cash drawer overdraft if cash is below zero.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  confirmOverdraft?: boolean;

  @ApiPropertyOptional({
    description: 'Settlement notes.',
    example: 'Paid in full to Muhammad Ali in cash at shop counter.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

