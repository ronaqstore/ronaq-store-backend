import { Prisma } from '../generated/prisma/client.js';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_CONSTRAINT_VIOLATION
  );
}

export function uniqueViolationColumns(error: unknown): string[] {
  if (!isUniqueConstraintViolation(error)) return [];

  const meta = (error as { meta?: Record<string, unknown> }).meta;
  if (!meta) return [];

  const columns: string[] = [];

  const target = meta['target'];
  if (Array.isArray(target)) {
    columns.push(...target.map((c) => String(c).toLowerCase()));
  } else if (typeof target === 'string') {
    columns.push(target.toLowerCase());
  }

  const adapter = meta['driverAdapterError'] as
    { cause?: { constraint?: { index?: unknown } } } | undefined;
  const indexName = adapter?.cause?.constraint?.index;
  if (typeof indexName === 'string') {
    const withoutSuffix = indexName.replace(/_key$/, '').toLowerCase();

    columns.push(withoutSuffix);
    const lastToken = withoutSuffix.split('_').pop();
    if (lastToken) columns.push(lastToken);
  }

  return [...new Set(columns)];
}

export function violatedColumn(error: unknown, column: string): boolean {
  const needle = column.toLowerCase();
  return uniqueViolationColumns(error).some(
    (c) => c === needle || c.endsWith(`_${needle}`),
  );
}
