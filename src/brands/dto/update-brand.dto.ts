import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateBrandDto {
  @ApiPropertyOptional({
    description: 'New brand name. Must still be unique within the shop.',
    example: 'Apple',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Toggle brand visibility in lists. Deactivated brands are hidden but kept for history.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
