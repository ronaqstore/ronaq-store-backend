import type { LedgerEntryDto } from '../common-dto/response/ledger-entry.dto.js';
import { getSkipNumber } from './paginate-helper.js';

export type LedgerBalanceRawRow = {
  id: string;
  type: string;
  date: string;
  reference?: string | null;
  notes?: string | null;
  status: string;
  amount: bigint;
  delta: bigint;
};

export function mapLedgerRunningBalances(
  raws: LedgerBalanceRawRow[],
  openingBalance: bigint,
): { entries: LedgerEntryDto[]; closingBalance: bigint } {
  let running = openingBalance;
  const entries = raws.map((r) => {
    running += r.delta;
    return {
      id: r.id,
      type: r.type,
      date: r.date,
      reference: r.reference,
      notes: r.notes,
      status: r.status,
      amount: Number(r.amount),
      delta: Number(r.delta),
      balance: Number(running),
    };
  });
  return { entries, closingBalance: running };
}

export function sortLedgerRawRows<
  T extends { sortAt: number; createdAt: number; id: string },
>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      a.sortAt - b.sortAt ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  );
}

export function finalizePartyLedger<
  T extends { sortAt: number; createdAt: number; id: string },
  M extends Record<string, unknown>,
>(
  rows: T[],
  mapRow: (row: T) => LedgerBalanceRawRow,
  openingBalance: bigint,
  page: number,
  pageSize: number,
  meta: M,
): M & {
  openingBalance: number;
  balance: number;
  page: number;
  pageSize: number;
  total: number;
  items: LedgerEntryDto[];
} {
  return buildPartyLedgerResponse(
    sortLedgerRawRows(rows).map(mapRow),
    openingBalance,
    page,
    pageSize,
    meta,
  );
}

export function buildPartyLedgerResponse<T extends Record<string, unknown>>(
  raws: LedgerBalanceRawRow[],
  openingBalance: bigint,
  page: number,
  pageSize: number,
  meta: T,
): T & {
  openingBalance: number;
  balance: number;
  page: number;
  pageSize: number;
  total: number;
  items: LedgerEntryDto[];
} {
  const { entries, closingBalance } = mapLedgerRunningBalances(
    raws,
    openingBalance,
  );
  const pageSlice = sliceLedgerPage(entries, page, pageSize);
  return {
    ...meta,
    openingBalance: Number(openingBalance),
    balance: Number(closingBalance),
    ...pageSlice,
  };
}

export function sliceLedgerPage(
  all: LedgerEntryDto[],
  page: number,
  pageSize: number,
): {
  items: LedgerEntryDto[];
  total: number;
  page: number;
  pageSize: number;
} {
  const skip = getSkipNumber(page, pageSize);
  return {
    page,
    pageSize,
    total: all.length,
    items: all.slice(skip, skip + pageSize),
  };
}
