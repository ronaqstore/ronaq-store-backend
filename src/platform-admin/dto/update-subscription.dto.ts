import { ApiPropertyOptional } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description:
      'New subscription end date. Must be in the future. Omit when only suspending.',
    example: '2026-12-05',
  })
  @IsOptional()
  @IsDateString()
  subscriptionEndsAt?: string;

  @ApiPropertyOptional({
    description:
      'false suspends the shop immediately. true reactivates it. Omit to leave the status unchanged.',
    example: false,
  })
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw new BadRequestException('isActive must be true or false');
  })
  @IsBoolean()
  isActive?: boolean;
}
