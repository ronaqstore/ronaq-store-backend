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
    for (const c of target) {
      const s = String(c).toLowerCase();
      columns.push(s);
      if (s.endsWith('_key')) {
        const withoutKey = s.replace(/_key$/, '');
        columns.push(withoutKey);
        const last = withoutKey.split('_').pop();
        if (last) columns.push(last);
      }
    }
  } else if (typeof target === 'string') {
    const s = target.toLowerCase();
    columns.push(s);
    if (s.endsWith('_key')) {
      const withoutKey = s.replace(/_key$/, '');
      columns.push(withoutKey);
      const last = withoutKey.split('_').pop();
      if (last) columns.push(last);
    }
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

export function isImeiUniqueViolation(error: unknown): boolean {
  if (isUniqueConstraintViolation(error)) {
    return (
      violatedColumn(error, 'imei1') ||
      violatedColumn(error, 'imei2') ||
      uniqueViolationColumns(error).some((c) => c.includes('imei'))
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2010'
  ) {
    const meta = error.meta as { code?: string; message?: string } | undefined;
    if (meta?.code === '23505') return true;
    const msg = error.message || '';
    if (
      msg.includes('23505') ||
      msg.includes('inventory_units_shop_id_imei') ||
      msg.includes('IMEI already exists')
    ) {
      return true;
    }
  }
  return false;
}
