import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CancelConsignmentDto {
  @ApiProperty({
    description: 'Double-tap protection client request UUID.',
    example: '01924f0a-0000-7000-8000-00000000beef',
  })
  @IsUUID()
  clientRequestId: string;

  @ApiProperty({
    description: 'Reason why the consignment agreement was cancelled.',
    example: 'Wrong product variant selected during intake.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  cancelReason: string;

  @ApiPropertyOptional({
    description: 'Additional notes regarding the cancellation.',
    example: 'Voided immediately before placing in stock display.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

