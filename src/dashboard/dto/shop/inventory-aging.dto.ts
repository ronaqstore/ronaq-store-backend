import { ApiProperty } from '@nestjs/swagger';

export class InventoryAgingBucketDto {
  @ApiProperty({ example: '0-15' })
  bucket: string;

  @ApiProperty({ example: '0–15 days' })
  label: string;

  @ApiProperty({ description: 'Count of phone units in stock', example: 14 })
  count: number;

  @ApiProperty({
    description: 'Total cost value of units in paisa',
    example: 45000000,
  })
  costValue: number;
}

export class ConditionSplitDto {
  @ApiProperty({ example: 25 })
  newCount: number;

  @ApiProperty({ description: 'Cost value in paisa', example: 85000000 })
  newCostValue: number;

  @ApiProperty({ example: 12 })
  usedCount: number;

  @ApiProperty({ description: 'Cost value in paisa', example: 34000000 })
  usedCostValue: number;
}

export class InventoryAgingResponseDto {
  @ApiProperty({
    description: 'Total stock value across phones and accessories in paisa',
    example: 145000000,
  })
  totalStockValue: number;

  @ApiProperty({
    description: 'Total phone stock value in paisa',
    example: 119000000,
  })
  phoneStockValue: number;

  @ApiProperty({
    description: 'Total accessories stock value in paisa',
    example: 26000000,
  })
  accessoriesStockValue: number;

  @ApiProperty({ description: 'Total IN_STOCK phones count', example: 37 })
  inStockPhonesCount: number;

  @ApiProperty({ type: [InventoryAgingBucketDto] })
  agingBuckets: InventoryAgingBucketDto[];

  @ApiProperty({ type: ConditionSplitDto })
  conditionSplit: ConditionSplitDto;
}
