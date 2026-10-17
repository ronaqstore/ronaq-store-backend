import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';

export const insufficientStock = (
  productName: string,
  available: number,
  requested: number,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Insufficient stock for ${productName}`,
    [
      `Only ${available} unit(s) of ${productName} are available but the sale requires ${requested}.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const countedQuantityRequired = (
  productName: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `ADJUSTMENT on "${productName}" needs countedQuantity`,
    [
      `"${productName}" is counted by quantity, so an ADJUSTMENT must send countedQuantity — the real number you found on the shelf. The system writes the difference (counted − system), never the typed number itself.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const quantityRequired = (productName: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `DAMAGED or LOST on "${productName}" needs quantity`,
    [
      `"${productName}" is counted by quantity, so tell the system how many units are damaged or lost with a positive quantity. The system removes exactly that many from stock.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unitIdRequired = (productName: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `DAMAGED or LOST on "${productName}" needs inventoryUnitId`,
    [
      `"${productName}" is a phone: every unit is one physical row with its own status. Send inventoryUnitId so the system can mark that exact phone as damaged or lost.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const adjustmentNotAllowedForSerialized = (
  productName: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `ADJUSTMENT is not allowed on "${productName}"`,
    [
      `"${productName}" is tracked as individual phones, so counting has nothing to adjust — there is no shelf-count number to type. Mark a specific phone as DAMAGED or LOST instead.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unwantedAdjustmentField = (
  productName: string,
  type: string,
  field: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `\`${field}\` is not accepted for ${type} on "${productName}"`,
    [
      `A ${type} stock change on "${productName}" does not use ${field}. Send only the fields this change needs, and read the plan for which product kinds use which field.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unitNotInStock = (
  productName: string,
  imei: string,
  status: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'This phone cannot be marked damaged or lost',
    [
      `The phone with ${imei} of "${productName}" is currently ${status}, so it is not sitting on the shelf for damage or loss. Only an IN_STOCK phone can be marked damaged or lost.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unitNotAvailableForSale = (
  productName: string,
  imei: string,
  status: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'This phone is not available to sell',
    [
      `The phone with IMEI ${imei} of "${productName}" is currently ${status}. Only an IN_STOCK phone in this shop can be sold — pick another IMEI.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};
