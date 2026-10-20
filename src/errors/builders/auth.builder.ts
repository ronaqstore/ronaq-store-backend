import { HttpStatus } from '@nestjs/common';
import { ErrorResponseDTO } from '../../common-dto/response/error-response.dto.js';

export const invalidToken = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Invalid or missing authentication token',
    [
      'The Bearer token is missing, has expired, or its signature does not match.',
    ],
    HttpStatus.UNAUTHORIZED,
  );
};

export const invalidOwnerPhone = (phone: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'That is not a valid phone number',
    [
      `${phone} is not a Pakistani mobile number. Use the form 03XX1234567, or with a country code 923XX1234567. The phone number is the owner's login id, so it must be one he actually owns.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const PHONE_ALREADY_TAKEN_CODE = 'PHONE_ALREADY_TAKEN';
export const PHONE_ALREADY_TAKEN_MESSAGE =
  'This mobile number is already used on the platform (shop login, platform admin, supplier, or customer). Pick a different one.';

export const ownerPhoneAlreadyRegistered = (
  phone: string,
): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'This phone number is already in use',
    [`${phone}: ${PHONE_ALREADY_TAKEN_MESSAGE}`],
    HttpStatus.BAD_REQUEST,
    PHONE_ALREADY_TAKEN_CODE,
  );
};

export const loginPhoneAlreadyTaken = (phone: string): ErrorResponseDTO =>
  ownerPhoneAlreadyRegistered(phone);

export const oneOwnerPerShop = (shopName: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    `${shopName} already has an owner`,
    [
      'Only one owner per shop is supported in the current release. Issue a new setup link for the existing owner instead of adding another.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const invalidSubscriptionDate = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Subscription end date is not a valid date',
    [
      'Send an ISO-8601 date such as 2027-01-15T00:00:00.000Z, or a plain date such as 2027-01-15.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const subscriptionEndInPast = (date: string): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Subscription end date must be in the future',
    [
      `${date} is already in the past, which would leave the shop suspended right away. Pick a future date, or send isActive: false if the intent was to suspend it.`,
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const invalidCredentials = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Phone number or password is incorrect',
    [
      'The phone number or password you entered is not correct. Check both and try again.',
    ],
    HttpStatus.UNAUTHORIZED,
  );
};

export const adminAccountDisabled = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Platform admin account is disabled',
    [
      'This Ronaq Store staff account has been deactivated. Ask another administrator to re-enable it.',
    ],
    HttpStatus.FORBIDDEN,
  );
};

export const shopSuspended = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Shop is suspended',
    [
      'Your shop subscription has ended or been suspended. Contact Ronaq Store support to renew.',
    ],
    HttpStatus.FORBIDDEN,
  );
};

export const userSuspended = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'User account is disabled',
    [
      'This user has been suspended. Only the shop owner or Ronaq Store support can re-enable it.',
    ],
    HttpStatus.FORBIDDEN,
  );
};

export const invalidSetupToken = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Invalid or expired setup link',
    [
      'This password-setup link has been used already or has expired. Request a new link from your shop admin.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};

export const currentPasswordIncorrect = (): ErrorResponseDTO => {
  return new ErrorResponseDTO(
    'Current password is incorrect',
    [
      'The current password you typed does not match. Re-enter it and try again.',
    ],
    HttpStatus.BAD_REQUEST,
  );
};
