import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';

export const trackingTypeLocked = (name: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Cannot change the stock tracking type of "${name}"`,
    [
      `"${name}" already has purchase or sale history, so its tracking type (QUANTITY or SERIALIZED) is locked. Changing it now would make every existing stock record wrong. Create a new product instead.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const stockNotEmptyForTrackingChange = (
  name: string,
  quantityOnHand: number,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Cannot switch "${name}" to SERIALIZED while it still has stock`,
    [
      `"${name}" still shows ${quantityOnHand} unit(s) on hand with no purchase or sale history to explain them. Set the stock to zero first, then switch the product to SERIALIZED.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};
