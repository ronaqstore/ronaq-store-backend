import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class OwnerLoginDto {
  @ApiProperty({
    description:
      'Shop owner mobile number in any format: 03001234567, 0300-1234567 or +923001234567.',
    example: '03001234567',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 20)
  phone: string;

  @ApiProperty({
    description:
      'Password the owner chose on the setup link. Minimum 8 characters.',
    example: 'DukaanOwner1',
  })
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

  @ApiPropertyOptional({
    description: 'Cloudflare Turnstile token from the login widget.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 2048)
  turnstileToken?: string;
}
