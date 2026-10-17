import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';
import { outstandingExceeded } from './entity.builder.js';

export const purchasePaidExceedsTotal = (
  totalAmount: number,
  paidNow: number,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Paid amount is more than the purchase total',
    [
      `This purchase totals ${totalAmount} paisa but ${paidNow} paisa was marked as paid. You cannot pay a supplier more than the bill. Lower the paid amount, or raise a line quantity or cost.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const openingStockCannotTakePayment = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Opening stock cannot record a payment',
    [
      'An opening-stock purchase is Day-0 data: it only fills the shelves, it has no bill and no cash leaves the drawer. Set paidNow to 0, or turn off isOpeningStock to record a real purchase.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const openingCashAlreadySet = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Opening cash already recorded',
    [
      'This shop already has an opening cash entry, and opening cash can only be set once — the cash ledger is append-only. Later changes belong to real payments, expenses or purchases, not another opening entry.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const imeisCountMismatch = (
  productName: string,
  quantity: number,
  imeiCount: number,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `IMEI count does not match quantity for ${productName}`,
    [
      `${quantity} unit(s) of "${productName}" were ordered but ${imeiCount} IMEI(s) were supplied. Every phone needs exactly one IMEI, so the two numbers must match.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const imeisNotAllowed = (productName: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `IMEIs are not allowed for ${productName}`,
    [
      `"${productName}" is tracked by quantity, not by IMEI. Remove the imeis list from this line — accessories only need a quantity.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const duplicateImei = (imei: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `IMEI ${imei} is already in inventory`,
    [
      `A phone with IMEI ${imei} already exists in this shop (from an earlier purchase, or listed twice on this one). IMEIs must be unique inside a shop, so fix the number before saving.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const paymentExceedsOutstanding = (
  payeeName: string,
  amount: number,
  remaining: number,
): ErrorResponseDTO => {
  const exceeded = outstandingExceeded();
  return new ErrorResponseDTO(
    exceeded.error,
    [
      `You are trying to pay ${amount} paisa but only ${remaining} paisa is left to ${payeeName}. Lower the amount, or pick a different bill.`,
      ...exceeded.message,
    ],
    exceeded.statusCode,
  );
};

export const purchaseSupplierMismatch = (
  purchaseNo: string,
  supplierName: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'That bill does not belong to this supplier',
    [
      `Purchase ${purchaseNo} was made from ${supplierName}, which is not the supplier you selected. Pay the right supplier, or drop purchaseId to pay down the opening balance instead.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const purchaseHasNoPayable = (purchaseNo: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Purchase ${purchaseNo} has no bill to pay`,
    [
      `An opening-stock purchase is Day-0 data — it only filled the shelves, so nothing is owed on it. Drop purchaseId to pay this supplier's opening balance, or pick a real purchase.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};
