import { ApiProperty } from '@nestjs/swagger';

export class DashboardRangeDto {
  @ApiProperty({ example: '2026-10-01' })
  from: string;

  @ApiProperty({ example: '2026-10-27' })
  to: string;

  @ApiProperty({ example: '2026-09-04' })
  prevFrom: string;

  @ApiProperty({ example: '2026-09-30' })
  prevTo: string;

  @ApiProperty({ example: 'day', enum: ['day', 'week', 'month'] })
  granularity: 'day' | 'week' | 'month';
}
