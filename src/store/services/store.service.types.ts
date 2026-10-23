export type ExistingStoreSettingsWhatsapp = {
  whatsappNumber: string | null;
};

export type ProcessImageFit = 'inside' | 'cover';

export type ProcessImageOptions = {
  fit: ProcessImageFit;
  maxEdge?: number;
  width?: number;
  height?: number;
};

export type ProcessedImageResult = {
  buffer: Buffer;
  ext: string;
  contentType: string;
};
