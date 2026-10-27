import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';
import { formatPaisaToRupees } from '../../helpers/csv.helper.js';

export const returnQuantityExceedsRemaining = (
  saleNo: string,
  productName: string,
  requested: number,
  remaining: number,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Cannot return that many of ${productName}`,
    [
      `Sale ${saleNo} sold and still shows only ${remaining} unit(s) of "${productName}" left to return (sold minus already returned), but the request asks for ${requested}. Lower the quantity or check the returns already recorded.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unitAlreadyReturned = (
  saleNo: string,
  imei: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'That phone was already returned',
    [
      `The phone with IMEI ${imei} sold on sale ${saleNo} appears in an earlier return. One IMEI can be returned only once, so this line was refused.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unitNotSoldForReturn = (
  saleNo: string,
  imei: string,
  status: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'This phone cannot be returned',
    [
      `The phone with IMEI ${imei} sold on sale ${saleNo} is currently ${status}, not SOLD, so there is no sold unit to take back. Fix the phone's status first, then retry the return.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const returnQuantityRequired = (
  productName: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Return line for "${productName}" needs quantity`,
    [
      `"${productName}" is tracked by quantity, so say how many units are being returned (sold minus already returned). The phone lines do not need this — one IMEI is one unit.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unwantedReturnItemField = (
  productName: string,
  field: string,
  reason: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `\`${field}\` is not valid on this return line`,
    [
      `The return line for "${productName}" ${reason}. Fix \`${field}\` and save again.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const refundExceedsAvailable = (
  refundAmount: number,
  available: number,
): ErrorResponseDTO => {
  const refundRs = formatPaisaToRupees(refundAmount);
  const availableRs = formatPaisaToRupees(available);
  return new ErrorResponseDTO(
    'Refund is more than can be given back',
    [
      `The refund is Rs ${refundRs} but only Rs ${availableRs} can be returned in cash right now. The return value first cancels the Udhar still owed on the sale, and a refund can never exceed what the customer actually paid (minus earlier refunds). Lower the refund — 0 is allowed.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};
