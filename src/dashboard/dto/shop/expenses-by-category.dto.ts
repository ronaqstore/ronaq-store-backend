import { ApiProperty } from '@nestjs/swagger';
import { DashboardRangeDto } from './range-response.dto.js';

export class ExpenseCategoryItemDto {
  @ApiProperty({ example: '0192e4...' })
  categoryId: string;

  @ApiProperty({ example: 'Rent' })
  name: string;

  @ApiProperty({
    description: 'Current period amount in paisa',
    example: 1500000,
  })
  amount: number;

  @ApiProperty({
    description: 'Previous period amount in paisa',
    example: 1500000,
  })
  previousAmount: number;

  @ApiProperty({ description: 'Percentage of total expenses', example: 45.2 })
  percentage: number;
}

export class ExpensesByCategoryResponseDto {
  @ApiProperty({ type: DashboardRangeDto })
  range: DashboardRangeDto;

  @ApiProperty({ type: [ExpenseCategoryItemDto] })
  categories: ExpenseCategoryItemDto[];

  @ApiProperty({
    description: 'Total expenses in current period in paisa',
    example: 3300000,
  })
  total: number;

  @ApiProperty({
    description: 'Total expenses in previous period in paisa',
    example: 3100000,
  })
  previousTotal: number;
}
