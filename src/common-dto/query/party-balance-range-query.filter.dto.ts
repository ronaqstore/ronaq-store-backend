import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PartyBalanceRangeQueryFilterDto {
  @ApiPropertyOptional({
    example: 0,
    description: 'Minimum opening balance in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOpeningBalance?: number;

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Maximum opening balance in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxOpeningBalance?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Minimum current balance in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minCurrentBalance?: number;

  @ApiPropertyOptional({
    example: 10000000,
    description: 'Maximum current balance in PAISA (inclusive).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCurrentBalance?: number;
}
