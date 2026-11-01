import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListPaginationQueryFilterDto } from '../../common-dto/query/list-pagination-query.filter.dto.js';
import {
  InclusiveDateFromQueryProperty,
  InclusiveDateToQueryProperty,
  OptionalSearchQueryProperty,
  SortOrderPeriodQueryProperty,
} from '../../helpers/query-filter.decorators.js';

export class ConsignmentQueryFilterDto extends ListPaginationQueryFilterDto {
  @OptionalSearchQueryProperty(
    'CON-0001',
    'Case-insensitive search across consignment number, consignor name, phone, CNIC, and IMEI.',
  )
  search?: string;

  @ApiPropertyOptional({
    example: 'IN_CUSTODY',
    description:
      'Filter by status: IN_CUSTODY | SOLD | SETTLED | RETURNED_TO_OWNER | CANCELLED.',
  })
  @IsOptional()
  @IsIn(['IN_CUSTODY', 'SOLD', 'SETTLED', 'RETURNED_TO_OWNER', 'CANCELLED'])
  status?:
    'IN_CUSTODY' | 'SOLD' | 'SETTLED' | 'RETURNED_TO_OWNER' | 'CANCELLED';

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-00000000000a',
    description: 'Filter by product ID.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    example: '01924f0a-0000-7000-8000-00000000000b',
    description: 'Filter by customer ID.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @InclusiveDateFromQueryProperty('intake_date')
  fromDate?: string;

  @InclusiveDateToQueryProperty('intake_date')
  toDate?: string;

  @SortOrderPeriodQueryProperty()
  sortOrder?: 'asc' | 'desc';
}
