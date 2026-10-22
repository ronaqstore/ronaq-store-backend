import { BadRequestException, applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export function optionalBooleanQueryTransform(
  fieldLabel: string,
): (params: TransformFnParams) => boolean | undefined {
  return ({ value }: TransformFnParams) => {
    if (value === undefined || value === null) return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    throw new BadRequestException(`${fieldLabel} must be true or false`);
  };
}

export function OptionalBooleanQueryProperty(
  fieldLabel: string,
  description: string,
) {
  return applyDecorators(
    ApiPropertyOptional({
      example: 'true',
      description,
    }),
    IsOptional(),
    Type(() => String),
    Transform(optionalBooleanQueryTransform(fieldLabel)),
    IsBoolean(),
  );
}

export function OptionalIsActiveQueryProperty(description: string) {
  return OptionalBooleanQueryProperty('isActive', description);
}

export function OptionalSearchQueryProperty(
  example: string,
  description: string,
) {
  return applyDecorators(
    ApiPropertyOptional({ example, description }),
    IsOptional(),
    IsString(),
  );
}

export function InclusiveDateFromQueryProperty(description: string) {
  return applyDecorators(
    ApiPropertyOptional({
      example: '2026-10-01',
      description,
    }),
    IsOptional(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    IsDateString(),
  );
}

export function InclusiveDateToQueryProperty(description: string) {
  return applyDecorators(
    ApiPropertyOptional({
      example: '2026-10-31',
      description,
    }),
    IsOptional(),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
    IsDateString(),
  );
}

export function SortOrderPeriodQueryProperty(
  description: string = 'asc or desc',
) {
  return applyDecorators(
    ApiPropertyOptional({ example: 'desc', description }),
    IsOptional(),
    IsIn(['asc', 'desc']),
  );
}

export function OptionalPaisaAmountQueryProperty(
  example: number,
  description: string,
) {
  return applyDecorators(
    ApiPropertyOptional({ example, description }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
  );
}
