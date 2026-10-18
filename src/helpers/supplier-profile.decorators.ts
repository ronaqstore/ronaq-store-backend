import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { normalizePhoneOrRaw } from './phone.helper.js';

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
