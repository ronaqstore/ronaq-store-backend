import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';

export const storeNotAvailable = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Store not available',
    ['This store is not available right now.'],
    HttpStatus.NOT_FOUND,
  );
};

export const slugReserved = (slug: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `The store name "${slug}" cannot be used`,
    [
      `${slug} is a reserved store address (e.g. "admin", "api", "www"). Pick a different one.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const productNotPublishable = (
  productName: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `"${productName}" cannot be published`,
    [
      'Only an active product can appear in the public store. Reactivate the product first, then publish it.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const ptaStatusNotAllowedForBrand = (
  brandName: string,
  ptaStatus: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `PTA status ${ptaStatus} is not allowed for ${brandName}`,
    [
      'JV, Bypass and MDM Bypass are only for Apple (iPhone). Android and other brands may use PTA Approved or Non PTA only.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const imageLimitExceeded = (
  productName: string,
  max: number,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `Too many images on "${productName}"`,
    [
      `A product can carry at most ${max} photos. Remove an old one before adding another.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const reorderImageMismatch = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Image order does not match the product',
    [
      'imageIds must contain every photo of this product exactly once. Compare what was sent with what is already saved.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const unsupportedImageType = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Photo is not a supported image',
    [
      'Only real JPEG, PNG or WebP files are accepted (checked by content, not by the file name).',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const photoFileRequired = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Photo is required',
    ['Send the image file in the multipart field named "image".'],
    HttpStatus.BAD_REQUEST,
  );
};
