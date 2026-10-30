import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateInventoryUnitDto {
  @ApiPropertyOptional({
    description:
      'Custom asking price in paisa for this unit. Pass null to revert to product default selling price.',
    example: 8500000,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  askingPrice?: number | null;

  @ApiPropertyOptional({
    description: 'Defect / condition notes for this specific device.',
    example: 'Minor scratch on rear glass',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  defectNotes?: string | null;

  @ApiPropertyOptional({
    description:
      'iPhone battery health percentage (1–100). Only valid for Apple units. Pass null to clear.',
    example: 92,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(100)
  batteryHealth?: number | null;

  @ApiPropertyOptional({
    description: 'Unit condition: NEW or USED.',
    enum: ['NEW', 'USED'],
    example: 'USED',
  })
  @IsOptional()
  @IsIn(['NEW', 'USED'])
  condition?: 'NEW' | 'USED';
}
