import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { AppConfigurationService } from '../../app-configuration/app-configuration.service.js';
import { logError } from '../../helpers/logger-helper.js';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrlBase: string;
  private readonly enabled: boolean;

  constructor(config: AppConfigurationService) {
    this.enabled = config.r2StorageEnabled;
    this.bucket = config.r2.bucket;
    this.publicUrlBase = config.r2.publicUrlBase;
    this.client = this.enabled
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
          forcePathStyle: true,
          credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
          },
        })
      : null;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.enabled || !this.client) {
      const base = this.publicUrlBase || 'https://placeholder.r2.dev';
      return `${base}/${key}`;
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      logError('r2-storage.service.ts', 'put', error, {
        bucket: this.bucket,
        key,
      });
      const code =
        (error as { name?: string; Code?: string }).name ||
        (error as { Code?: string }).Code ||
        '';
      if (code === 'AccessDenied' || code === 'InvalidAccessKeyId') {
        throw new ServiceUnavailableException(
          'Image storage denied. Check Cloudflare R2 API token permissions (Object Read & Write) for this bucket.',
        );
      }
      throw new ServiceUnavailableException(
        'Image storage is temporarily unavailable. Try again shortly.',
      );
    }
    return this.buildPublicUrl(key);
  }

  buildPublicUrl(key: string): string {
    return `${this.publicUrlBase}/${key}`;
  }

  async deleteByUrl(url: string): Promise<void> {
    if (!this.enabled || !this.client || !this.publicUrlBase) return;
    const prefix = `${this.publicUrlBase}/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    if (!key) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      logError('r2-storage.service.ts', 'deleteByUrl', error, { url });
    }
  }
}
