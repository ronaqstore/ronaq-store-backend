import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';

export const consignmentNotFound = (id: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Consignment not found',
    [`No consignment with id "${id}" exists for this shop.`],
    HttpStatus.NOT_FOUND,
  );
};

export const consignmentNotAvailableForReturn = (
  consignmentNo: string,
  status: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Consignment ${consignmentNo} cannot be returned`,
    [
      `Only consignments in IN_CUSTODY status can be returned to owner, but this one is ${status}.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const consignmentNotAvailableForSettlement = (
  consignmentNo: string,
  status: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Consignment ${consignmentNo} cannot be settled`,
    [
      `Only consignments in SOLD status can be settled with the owner, but this one is ${status}.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const consignmentNotAvailableForCancellation = (
  consignmentNo: string,
  status: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Consignment ${consignmentNo} cannot be cancelled`,
    [
      `Only consignments in IN_CUSTODY status can be cancelled, but this one is ${status}.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const saleCancelConsignmentSettled = (
  saleNo: string,
  consignmentNo: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Sale ${saleNo} cannot be cancelled`,
    [
      `Consignment ${consignmentNo} attached to this sale has already been settled and paid out to the owner. Reverse the payout before cancelling this sale.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};
