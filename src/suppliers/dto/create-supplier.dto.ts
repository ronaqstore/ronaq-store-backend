import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';
import {
  OptionalSupplierAddressProperty,
  OptionalSupplierCnicProperty,
  OptionalSupplierNotesProperty,
  OptionalSupplierOpeningBalanceProperty,
  OptionalSupplierPhoneProperty,
} from '../../helpers/supplier-profile.decorators.js';

export class CreateSupplierDto {
  @ApiProperty({
    description:
      'Supplier name, e.g. "ABC Mobiles, Preshawar". Not unique — the database deliberately allows two suppliers with the same name.',
    example: 'ABC Mobiles, Peshawar',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 150)
  name: string;

  @OptionalSupplierPhoneProperty()
  phone?: string;

  @OptionalSupplierCnicProperty()
  cnic?: string;

  @OptionalSupplierAddressProperty()
  address?: string;

  @OptionalSupplierNotesProperty()
  notes?: string;

  @OptionalSupplierOpeningBalanceProperty(
    'What you already owed this supplier before Ronaq Store — Day-0 data. In PAISA (Rs 50,000 = 5000000). Integer, cannot be negative.',
  )
  openingBalance?: number;

  @ApiPropertyOptional({
    description: 'Set false to hide the supplier without deleting it.',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
