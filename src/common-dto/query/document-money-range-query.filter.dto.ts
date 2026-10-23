import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class DocumentMoneyRangeQueryFilterDto {
  @ApiPropertyOptional({
    example: 1000000,
    description: 'Minimum total amount in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minTotalAmount?: number;

  @ApiPropertyOptional({
    example: 50000000,
    description: 'Maximum total amount in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxTotalAmount?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Minimum paid amount in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPaidAmount?: number;

  @ApiPropertyOptional({
    example: 10000000,
    description: 'Maximum paid amount in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPaidAmount?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Minimum outstanding amount in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOutstandingAmount?: number;

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Maximum outstanding amount in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxOutstandingAmount?: number;
}
