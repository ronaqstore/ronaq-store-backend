import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidPkCnic, normalizeCnicOrNull } from './cnic.helper.js';
import { normalizePhoneOrRaw } from './phone.helper.js';

@ValidatorConstraint({ name: 'isPkCnic', async: false })
class IsPkCnicConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true;
    return typeof value === 'string' && isValidPkCnic(value);
  }

  defaultMessage(): string {
    return 'cnic must be a valid 13-digit Pakistani CNIC (area code 1–7)';
  }
}

export function OptionalSupplierPhoneProperty(example: string = '03001234567') {
  return applyDecorators(
    ApiPropertyOptional({ example }),
    Transform(({ value }) =>
      typeof value === 'string' ? normalizePhoneOrRaw(value.trim()) : value,
    ),
    IsOptional(),
    IsString(),
    Length(1, 30),
  );
}

export function OptionalSupplierCnicProperty() {
  return applyDecorators(
    ApiPropertyOptional({
      example: '17301-1234567-1',
      description:
        'Pakistani CNIC (13 digits, area code 1–7). Optional dashes. Empty clears.',
      maxLength: 15,
      nullable: true,
    }),
    Transform(({ value }) => normalizeCnicOrNull(value)),
    ValidateIf((_, v) => v !== undefined && v !== null),
    IsString(),
    Matches(/^\d{5}-\d{7}-\d$/, {
      message: 'cnic must be formatted as XXXXX-XXXXXXX-X',
    }),
    Validate(IsPkCnicConstraint),
  );
}

export function OptionalSupplierAddressProperty() {
  return applyDecorators(
    ApiPropertyOptional({
      example: 'Suite 4, Hall Road, Lahore',
      maxLength: 300,
    }),
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsOptional(),
    IsString(),
    Length(0, 300),
  );
}

export function OptionalSupplierNotesProperty() {
  return applyDecorators(
    ApiPropertyOptional({
      example: 'Only sells original chargers',
      maxLength: 1000,
    }),
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsOptional(),
    IsString(),
    Length(0, 1000),
  );
}

export function OptionalSupplierOpeningBalanceProperty(
  description: string,
  example: number = 5000000,
) {
  return applyDecorators(
    ApiPropertyOptional({ description, example }),
    IsOptional(),
    IsInt(),
    Min(0),
    Max(Number.MAX_SAFE_INTEGER),
  );
}
