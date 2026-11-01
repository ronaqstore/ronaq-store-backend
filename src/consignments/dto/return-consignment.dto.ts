import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class ReturnConsignmentDto {
  @ApiProperty({
    description: 'Double-tap protection client request UUID.',
    example: '01924f0a-0000-7000-8000-00000000beef',
  })
  @IsUUID()
  clientRequestId: string;

  @ApiProperty({
    description: 'Reason why the phone was returned to the owner.',
    example:
      'Customer requested phone return as they found their own private buyer.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  returnReason: string;

  @ApiPropertyOptional({
    description: 'Additional notes regarding the return.',
    example: 'Returned in same physical condition with original box.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
