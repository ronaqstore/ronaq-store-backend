import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import {
  OptionalSupplierAddressProperty,
  OptionalSupplierNotesProperty,
  OptionalSupplierOpeningBalanceProperty,
  OptionalSupplierPhoneProperty,
} from '../../helpers/supplier-profile.decorators.js';

export class UpdateSupplierDto {
  @ApiPropertyOptional({
    description:
      'New supplier name. Blocked for the system "Walk-in seller" row (403).',
    example: 'ABC Mobiles (Peshawar) updated',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(2, 150)
  name?: string;

  @OptionalSupplierPhoneProperty()
  phone?: string;

  @OptionalSupplierAddressProperty()
  address?: string;

  @OptionalSupplierNotesProperty()
  notes?: string;

  @OptionalSupplierOpeningBalanceProperty(
    'Correction to the Day-0 owed amount, in PAISA. Cannot be negative.',
  )
  openingBalance?: number;

  @ApiPropertyOptional({
    description:
      'Set false to hide the supplier without deleting it. Blocked for the system "Walk-in seller" row (403).',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
