import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';

export const cashReconciliationReasonRequired = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Reason required for the difference',
    [
      'The counted cash and the system cash do not match, so a reason is required to record this reconciliation. Explain what happened (for example "wrong change given") — it keeps the ledger honest.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const supplierOpeningBalanceLocked = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Cannot change opening balance',
    [
      'This supplier already has payments or purchases on the ledger, so the opening balance can no longer be edited. Correct the balance with a payment or purchase instead of changing the opening figure.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const invalidReportRange = (
  from: string,
  to: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Report range is backwards',
    [
      `The report starts at ${from} and ends at ${to}, but the start comes after the end. Swap the two dates and try again.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const reportPeriodTooLong = (days: number): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Report range is too long',
    [
      `This report covers ${days} days, more than the 366 limit. Pick a shorter range — a month or a quarter is easier to scan, and you can export any range you like since the CSV shows every row.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const pdfExportNotAvailable = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'PDF export is coming later',
    [
      'Ask for format=csv for now — every report downloads exactly the same rows as the CSV. PDF is a separate ticket.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};
