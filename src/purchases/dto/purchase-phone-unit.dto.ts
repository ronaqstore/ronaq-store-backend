import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const IMEI_PATTERN = /^[0-9A-Za-z]{4,20}$/;

export class PurchasePhoneUnitDto {
  @ApiProperty({
    description: 'Primary IMEI for this physical phone.',
    example: '111223344556677',
  })
  @IsString()
  @Matches(IMEI_PATTERN)
  imei1: string;

  @ApiProperty({
    description:
      'Secondary IMEI (dual-SIM). Required and must differ from imei1.',
    example: '111223344556688',
  })
  @IsString()
  @Matches(IMEI_PATTERN)
  imei2: string;

  @ApiPropertyOptional({
    description:
      'Condition of this phone. Defaults to the line condition, then NEW.',
    example: 'NEW',
    default: 'NEW',
  })
  @IsOptional()
  @IsIn(['NEW', 'USED'])
  condition?: 'NEW' | 'USED';

  @ApiPropertyOptional({
    description: 'iPhone battery health percent (1–100). Apple brand only.',
    example: 97,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  batteryHealth?: number;

  @ApiPropertyOptional({
    description:
      'Asking price for this unit in paisa. Null/omit = product default selling price.',
    example: 5200000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  askingPrice?: number;

  @ApiPropertyOptional({
    description:
      'Defect notes (dead, water damage, broken camera/touch/sensor/screen).',
    example: 'Water damage — no shop warranty',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  defectNotes?: string;
}
