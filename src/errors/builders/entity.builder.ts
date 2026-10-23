import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';

export const resourceNotFound = (
  name: string,
  id?: string,
): ErrorResponseDTO => {
  const what = id ? `${name} with ID ${id}` : `${name}`;
  return new ErrorResponseDTO(
    `${what} not found`,
    [
      `The ${what} either does not exist, belongs to another shop, or has been deactivated / cancelled.`,
    ],
    HttpStatus.NOT_FOUND,
  );
};

export const cancelledRowMutationForbidden = (
  name: string,
  id: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Cannot modify a cancelled ${name}`,
    [
      `${name} (${id}) is in CANCELLED status and cannot be edited. Create a new record instead.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const duplicateName = (
  name: string,
  value: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `${name} "${value}" already exists`,
    [
      `Another ${name.toLowerCase()} with this name already exists in your shop. Please pick a different name.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const systemRowProtected = (name: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Cannot edit or deactivate the system ${name}`,
    [
      `The default "${name}" row is used by other workflows and cannot be renamed or removed.`,
    ],
    HttpStatus.FORBIDDEN,
  );
};

export const requiredFieldCannotBeNull = (
  entityName: string,
  fieldLabel: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `${entityName} ${fieldLabel.toLowerCase()} cannot be null`,
    [
      `${fieldLabel} is required on a ${entityName.toLowerCase()}, so it cannot be cleared. Send a value instead, or omit the field entirely to leave it unchanged.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const SUPPLIER_CNIC_DUPLICATE_CODE = 'SUPPLIER_CNIC_DUPLICATE';
export const SUPPLIER_CNIC_DUPLICATE_MESSAGE =
  'Another supplier in your shop already uses this CNIC. Pick a different one.';

export const duplicateFieldValue = (
  name: string,
  fieldLabel: string,
  value: string,
): ErrorResponseDTO => {
  const isSupplierCnic =
    name.toLowerCase() === 'supplier' && fieldLabel.toLowerCase() === 'cnic';
  return new ErrorResponseDTO(
    `${name} ${fieldLabel} "${value}" already exists`,
    [
      isSupplierCnic
        ? SUPPLIER_CNIC_DUPLICATE_MESSAGE
        : `Another ${name.toLowerCase()} in your shop already uses this ${fieldLabel}. ${fieldLabel} must be unique inside a shop, so pick a different one.`,
    ],
    HttpStatus.BAD_REQUEST,
    isSupplierCnic ? SUPPLIER_CNIC_DUPLICATE_CODE : undefined,
  );
};

export const outstandingExceeded = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Payment amount exceeds current outstanding',
    [
      'The amount you are trying to record is larger than the current balance owed. Check the customer or supplier ledger.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const tooManyRequests = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Too many requests',
    [
      'You have hit the request limit for the public store this minute. Wait a moment and try again.',
    ],
    HttpStatus.TOO_MANY_REQUESTS,
  );
};
