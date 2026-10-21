import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import type { UploadedImageFile } from '../dto/uploaded-image-file.type.js';
import { unsupportedImageType } from '../../errors/error.builder.js';
import type {
  ProcessImageOptions,
  ProcessedImageResult,
} from '../services/store.service.types.js';

const SUPPORTED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp']);

export async function processStoreImage(
  file: UploadedImageFile,
  options: ProcessImageOptions,
): Promise<ProcessedImageResult> {
  const sharpOptions = { limitInputPixels: 50_000_000 };
  const { fit } = options;
  const width = options.width ?? options.maxEdge;
  const height = options.height ?? options.maxEdge;
  if (!width || !height) {
    throw new BadRequestException(unsupportedImageType());
  }

  let format: string | undefined;
  try {
    const metadata = await sharp(file.buffer, sharpOptions).metadata();
    format = metadata.format;
  } catch {
    throw new BadRequestException(unsupportedImageType());
  }
  if (!format || !SUPPORTED_IMAGE_FORMATS.has(format)) {
    throw new BadRequestException(unsupportedImageType());
  }

  let buffer: Buffer;
  try {
    buffer = await sharp(file.buffer, sharpOptions)
      .rotate()
      .resize({
        width,
        height,
        fit,
        position: 'centre',
        withoutEnlargement: fit === 'inside',
      })
      .toBuffer();
  } catch {
    throw new BadRequestException(unsupportedImageType());
  }

  if (format === 'jpeg') {
    return { buffer, ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (format === 'png') {
    return { buffer, ext: 'png', contentType: 'image/png' };
  }
  return { buffer, ext: 'webp', contentType: 'image/webp' };
}
