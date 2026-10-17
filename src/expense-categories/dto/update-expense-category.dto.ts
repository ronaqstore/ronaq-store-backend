import 'class-validator';
import {
  OptionalNamedEntityUpdateIsActiveProperty,
  OptionalNamedEntityUpdateNameProperty,
} from '../../helpers/named-entity-update.decorators.js';

export class UpdateExpenseCategoryDto {
  @OptionalNamedEntityUpdateNameProperty(
    'Shop Rent',
    'New expense category name. Must still be unique within the shop.',
  )
  name?: string;

  @OptionalNamedEntityUpdateIsActiveProperty()
  isActive?: boolean;
}
