import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { toCsv, type CsvColumn } from '../../helpers/csv.helper.js';
import { pdfExportNotAvailable } from '../../errors/error.builder.js';
import { ApiSuccessResponseDTO } from '../../common-dto/response/api-success-response.dto.js';
import type { ReportQueryFilterDto } from '../dto/report-query.filter.js';
import type { ReportPageResponseDTO } from '../dto/report-page-response.dto.js';

export function exportReportOrJson<T, S>(
  res: Response,
  query: ReportQueryFilterDto,
  report: ReportPageResponseDTO<T, S>,
  name: string,
  columns: CsvColumn<T>[],
  summaryCsv: (summary: S) => string,
  jsonMessage: string,
): ApiSuccessResponseDTO<ReportPageResponseDTO<T, S>> | string {
  if (!query.format) {
    return new ApiSuccessResponseDTO(jsonMessage, report);
  }
  if (query.format === 'pdf') {
    throw new BadRequestException(pdfExportNotAvailable());
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${reportCsvFilename(name, report)}"`,
  );
  return `${summaryCsv(report.summary)}\r\n\r\n${toCsv(report.items, columns)}`;
}

export function reportCsvFilename<T, S>(
  name: string,
  report: ReportPageResponseDTO<T, S>,
): string {
  return `${name}-${report.from}-to-${report.to}.csv`;
}
