import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsString } from 'class-validator';

export interface BelowCostItem {
  productName: string;
  imei?: string;
  unitPrice: number;
  unitCost: number;
  shortfall: number;
}

export class BelowCostSaleResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  confirmBelowCost: true;

  @ApiProperty({
    description: 'Total loss in paisa below cost across all lines.',
    example: 500000,
  })
  @IsNumber()
  shortfall: number;

  @ApiProperty({
    description: 'Lines sold below cost.',
  })
  @IsArray()
  items: BelowCostItem[];

  @ApiProperty({
    example:
      'Warning: One or more items are being sold below cost (Total Shortfall: Rs 5,000). Do you want to proceed with this sale?',
  })
  @IsString()
  message: string;

  constructor(items: BelowCostItem[], shortfall: number) {
    this.confirmBelowCost = true;
    this.items = items;
    this.shortfall = shortfall;
    const shortfallRs = Math.round(shortfall / 100).toLocaleString('en-PK');
    this.message = `Warning: One or more items are being sold below cost (Total Shortfall: Rs ${shortfallRs}). Do you want to proceed with this sale?`;
  }
}
