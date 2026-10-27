import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateOwnerInvestmentDto {
  @ApiProperty({
    description:
      'Double-tap protection. Generate ONE uuid per opened Save screen and reuse it if the request is retried. If this id was already saved the system returns success instead of creating a second cash movement.',
    example: '01924f0a-0000-7000-8000-00000000beef',
  })
  @IsUUID()
  clientRequestId: string;

  @ApiProperty({
    description:
      'Cash the owner puts into the shop, in PAISA. Rs 200,000 = 20000000. Must be greater than zero.',
    example: 20000000,
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amount: number;

  @ApiPropertyOptional({
    description:
      'Business day the money entered the drawer, as YYYY-MM-DD. Defaults to today in Asia/Karachi.',
    example: '2026-10-08',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Optional note about the investment.',
    example: 'Brought money from home to restock',
    maxLength: 1000,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}
