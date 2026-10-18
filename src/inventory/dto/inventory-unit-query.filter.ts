import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class InventoryUnitQueryFilterDto {
  @ApiProperty({
    description: 'Product whose in-stock phone units to list.',
    example: '01924f0a-0000-7000-8000-000000000101',
  })
  @IsUUID()
  productId: string;
}
