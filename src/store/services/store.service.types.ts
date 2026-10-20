export type ExistingStoreSettingsWhatsapp = {
  whatsappNumber: string | null;
};

export type ProcessImageFit = 'inside' | 'cover';

export type ProcessImageOptions = {
  maxEdge: number;
  fit: ProcessImageFit;
};

export type ProcessedImageResult = {
  buffer: Buffer;
  ext: string;
  contentType: string;
};
