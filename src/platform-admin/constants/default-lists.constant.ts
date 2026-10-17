export const DEFAULT_CATEGORIES = [
  'Mobile Phones',
  'Accessories',
  'Chargers & Cables',
  'Cases & Covers',
  'Screen Guards',
  'Earphones',
  'Power Banks',
] as const;

export const DEFAULT_BRANDS: readonly string[] = [];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Internet',
  'Salary',
  'Transport',
  'Maintenance',
  'Marketing',
  'Other',
] as const;

export const WALK_IN_SUPPLIER = {
  name: 'Walk-in seller',
  notes: 'Default supplier for used phones bought from walk-in sellers.',
  isSystem: true,
} as const;
