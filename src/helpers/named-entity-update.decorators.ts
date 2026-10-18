import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export function OptionalNamedEntityUpdateNameProperty(
  example: string,
  description: string,
) {
  return applyDecorators(
    ApiPropertyOptional({ description, example }),
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsOptional(),
    IsString(),
    Length(2, 100),
  );
}

export function OptionalNamedEntityUpdateIsActiveProperty() {
  return applyDecorators(
    ApiPropertyOptional({
      description:
        'Toggle category visibility in lists. Deactivated categories are hidden but kept for history.',
      example: false,
    }),
    IsOptional(),
    IsBoolean(),
  );
}
