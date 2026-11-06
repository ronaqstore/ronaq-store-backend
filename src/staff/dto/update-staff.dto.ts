import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';

export class UpdateStaffDto {
  @ApiPropertyOptional({
    description: 'Updated staff member full name',
    example: 'Muhammad Bilal Khan',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated staff role (cannot change to OWNER)',
    enum: [UserRole.MANAGER, UserRole.SALESMAN],
    example: UserRole.MANAGER,
  })
  @IsOptional()
  @IsString()
  @IsIn([UserRole.MANAGER, UserRole.SALESMAN], {
    message: 'role must be either MANAGER or SALESMAN',
  })
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Staff status (ACTIVE or SUSPENDED)',
    enum: [UserStatus.ACTIVE, UserStatus.SUSPENDED],
    example: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsString()
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED])
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'New password for password reset (min 6, max 72 characters)',
    example: 'NewStaffPass456',
    minLength: 6,
    maxLength: 72,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password?: string;
}
