import { OptionalPaisaAmountQueryProperty } from '../../helpers/query-filter.decorators.js';

export class AmountRangeQueryFilterDto {
  @OptionalPaisaAmountQueryProperty(0, 'Minimum amount in PAISA (inclusive).')
  minAmount?: number;

  @OptionalPaisaAmountQueryProperty(
    5_000_000,
    'Maximum amount in PAISA (inclusive).',
  )
  maxAmount?: number;
}
