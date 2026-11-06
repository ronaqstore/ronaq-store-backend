import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';

export class ResponseStaffDto {
  @ApiProperty({
    description: 'Unique user UUID',
    example: '01924f0a-0000-7000-8000-000000000001',
  })
  id: string;

  @ApiProperty({
    description: 'Shop ID this staff member belongs to',
    example: '01924f0a-0000-7000-8000-000000000002',
  })
  shopId: string;

  @ApiProperty({
    description: 'Staff member full name',
    example: 'Muhammad Bilal',
  })
  name: string;

  @ApiProperty({
    description: 'Canonical login phone number',
    example: '923001234567',
  })
  phone: string;

  @ApiProperty({
    description: 'Staff role',
    enum: UserRole,
    example: UserRole.SALESMAN,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Staff status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Account update timestamp',
  })
  updatedAt: Date;
}
