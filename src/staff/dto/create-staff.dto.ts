import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../generated/prisma/enums.js';

export class CreateStaffDto {
  @ApiProperty({
    description: 'Staff member full name',
    example: 'Muhammad Bilal',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Pakistani login phone number (03XXXXXXXXX or +923XXXXXXXXX)',
    example: '03001234567',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^((\+92)|(0092)|(92)|(0))?3[0-9]{9}$/, {
    message: 'phone must be a valid Pakistani mobile number (e.g. 03001234567)',
  })
  phone: string;

  @ApiProperty({
    description: 'Staff role in store',
    enum: [UserRole.MANAGER, UserRole.SALESMAN],
    example: UserRole.SALESMAN,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([UserRole.MANAGER, UserRole.SALESMAN], {
    message: 'role must be either MANAGER or SALESMAN',
  })
  role: UserRole;

  @ApiProperty({
    description: 'Initial login password (min 6, max 72 characters)',
    example: 'StaffPass123',
    minLength: 6,
    maxLength: 72,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
