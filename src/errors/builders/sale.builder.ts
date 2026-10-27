import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';
import { formatPaisaToRupees } from '../../helpers/csv.helper.js';

export const customerRequiredForSale = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'This sale needs a customer',
    [
      'A sale that includes a phone, or that leaves any amount unpaid (Udhar), cannot be walk-in. Pick a customer first.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const discountExceedsSubtotal = (
  discount: number,
  subtotal: number,
): ErrorResponseDTO => {
  const discountRs = formatPaisaToRupees(discount);
  const subtotalRs = formatPaisaToRupees(subtotal);
  return new ErrorResponseDTO(
    'The discount is bigger than the sale subtotal',
    [
      `A discount of Rs ${discountRs} cannot be applied to a subtotal of Rs ${subtotalRs}. Reduce the discount so it fits inside the subtotal.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const salePaidExceedsTotal = (
  total: number,
  paidNow: number,
): ErrorResponseDTO => {
  const paidRs = formatPaisaToRupees(paidNow);
  const totalRs = formatPaisaToRupees(total);
  return new ErrorResponseDTO(
    'The paid amount is bigger than the sale total',
    [
      `You marked Rs ${paidRs} as paid but the sale total is Rs ${totalRs}. The unpaid part of a sale cannot be negative — reduce the paid amount.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unwantedSaleItemField = (
  productName: string,
  field: string,
  reason: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `\`${field}\` is not valid on this sale line`,
    [
      `The line for "${productName}" ${reason}. Fix \`${field}\` and save again.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const purchaseCancelUnitNotInStock = (
  purchaseNo: string,
  imei: string,
  status: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Purchase ${purchaseNo} cannot be cancelled`,
    [
      `The phone with IMEI ${imei} from this purchase is currently ${status}, not IN_STOCK. Cancelling would put a sold, damaged or lost phone back on the shelf as if it were never gone, so the purchase stays until that phone is IN_STOCK again.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const saleCancelUnitNotSold = (
  saleNo: string,
  imei: string,
  status: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Sale ${saleNo} cannot be cancelled`,
    [
      `The phone with IMEI ${imei} sold on this sale is currently ${status}, not SOLD, so there is no sold stock to put back. Fix the phone's status first, then cancel the sale.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const inventoryUnitIdRequiredForSale = (
  productName: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'This sale line needs inventoryUnitId',
    [
      `"${productName}" is tracked as individual phones, so the line must name the exact phone being sold with inventoryUnitId. Pick an IN_STOCK IMEI from the list.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const warrantyDaysRequiredForUsedPhone = (
  productName: string,
  imei: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Used phones need a shop warranty',
    [
      `"${productName}" (IMEI ${imei}) is USED, so pick a shop warranty of 1, 2, or 3 days on this sale line.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const companyWarrantyForNewPhone = (
  productName: string,
  imei: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Brand-new phones use company warranty',
    [
      `"${productName}" (IMEI ${imei}) is NEW — warranty comes from the company. Do not set shop warranty days on this line.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const saleHasReturns = (saleNo: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Sale ${saleNo} cannot be cancelled`,
    [
      `Sale ${saleNo} already has returns against it, and a sale with returns can only be fixed by cancelling the returns — never by cancelling the sale. The original sale, its payments and the returns must all stay as history.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};
