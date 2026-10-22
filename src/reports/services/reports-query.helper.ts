import { BadRequestException, Injectable } from '@nestjs/common';
import { periodRange, businessToday } from '../../helpers/date.helper.js';
import { normalizePagination } from '../../helpers/paginate-helper.js';
import { buildTokenizedSearchAnd } from '../../helpers/tokenized-search.helper.js';
import {
  invalidReportRange,
  reportPeriodTooLong,
} from '../../errors/error.builder.js';
import type { ReportQueryFilterDto } from '../dto/report-query.filter.js';
import { ReportPageResponseDTO } from '../dto/report-page-response.dto.js';

function reportSortKey(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return String(value);
}

@Injectable()
export class ReportsQueryHelper {
  resolveRange(query: ReportQueryFilterDto): {
    start: Date;
    end: Date;
    from: string;
    to: string;
  } {
    const range = periodRange(query.period, query.from, query.to);
    if (range.from > range.to) {
      throw new BadRequestException(invalidReportRange(range.from, range.to));
    }
    const days = (range.end.getTime() - range.start.getTime()) / 86_400_000;
    if (days > 366) {
      throw new BadRequestException(reportPeriodTooLong(days));
    }
    return range;
  }

  searchOr(
    query: ReportQueryFilterDto,
    fields: string[],
  ): Record<string, unknown> {
    const and = buildTokenizedSearchAnd<Record<string, unknown>>(
      query.search,
      (token) => {
        const contains = { contains: token, mode: 'insensitive' as const };
        return fields.map((field) => {
          if (field === 'customerName') {
            return { customer: { name: contains } };
          }
          if (field === 'supplierName') {
            return { supplier: { name: contains } };
          }
          if (field === 'categoryName') {
            return { category: { name: contains } };
          }
          if (field === 'productName') {
            return { product: { name: contains } };
          }
          return { [field]: contains };
        });
      },
    );
    const first = and[0];
    if (!first) return {};
    if (and.length === 1) return first;
    return { AND: and };
  }

  orderBy(
    fallback: string,
    query: ReportQueryFilterDto,
    allowed: string[],
  ): Record<string, 'asc' | 'desc'> {
    const column = allowed.includes(query.sortBy ?? '')
      ? (query.sortBy as string)
      : fallback;
    return { [column]: query.sortOrder ?? 'desc' };
  }

  pageSnapshot<T, S>(
    rows: T[],
    query: ReportQueryFilterDto,
    fallback: string,
    allowed: string[],
    summary: S,
  ): ReportPageResponseDTO<T, S> {
    const { page, pageSize } = normalizePagination(
      query.page,
      query.pageSize,
      100,
    );
    const column = allowed.includes(query.sortBy ?? '')
      ? (query.sortBy as string)
      : fallback;
    const order = query.sortOrder ?? 'desc';
    const key = column as keyof T;
    const sorted = [...rows].sort((a, b) => {
      const av = reportSortKey(a[key]);
      const bv = reportSortKey(b[key]);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return order === 'asc' ? cmp : -cmp;
    });
    const startIndex = (page - 1) * pageSize;
    const today = businessToday();
    return new ReportPageResponseDTO(
      sorted.slice(startIndex, startIndex + pageSize),
      summary,
      rows.length,
      page,
      pageSize,
      today,
      today,
    );
  }
}
