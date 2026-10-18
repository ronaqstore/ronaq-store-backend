import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ReturnItemDto {
  @ApiProperty({
    description:
      'The sale line being returned. Every id must belong to the sale in the URL — 404 otherwise. Find these ids (with IMEI and already-returned quantities) on GET /sales/{id}.',
    example: '01924f0a-0000-7000-8000-000000000201',
  })
  @IsUUID()
  saleItemId: string;

  @ApiPropertyOptional({
    description:
      'How many units of this line are returned. REQUIRED on quantity-tracked lines; omit (or send 1) on a phone line — one IMEI is one unit.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  quantity?: number;

  @ApiProperty({
    description:
      'GOOD goes back on the shelf and becomes sellable again. DAMAGED does not — it is taken back off the shelf immediately (phones become DAMAGED units, accessories get a write-off movement).',
    enum: ['GOOD', 'DAMAGED'],
    example: 'GOOD',
  })
  @IsIn(['GOOD', 'DAMAGED'])
  condition: 'GOOD' | 'DAMAGED';
}
