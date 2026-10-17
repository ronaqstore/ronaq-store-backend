import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

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
}
