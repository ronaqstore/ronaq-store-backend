import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class PlatformAdminLoginDto {
  @ApiProperty({
    description: 'Ronaq Store staff mobile number or email.',
    example: '03001234567',
  })
  @IsString()
  @IsNotEmpty()
  @Length(5, 100)
  phone: string;

  @ApiProperty({ description: 'Admin password.', example: 'AdminOwner1' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 72)
  password: string;

  @ApiPropertyOptional({
    description:
      'When true the access token lasts 30 days; otherwise 24 hours.',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  rememberMe?: boolean;
}
