import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UploadedImageFile } from '../dto/uploaded-image-file.type.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { resourceNotFound } from '../../errors/error.builder.js';
import { processStoreImage } from '../helpers/store-image-process.helper.js';
import { StoreCacheService } from './store-cache.service.js';
import { StorefrontRevalidateService } from './storefront-revalidate.service.js';
import { R2StorageService } from './r2-storage.service.js';

const MAX_LOGO_EDGE = 512;
const BANNER_WIDTH = 1600;
const BANNER_HEIGHT = 700;

@Injectable()
export class StoreBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: StoreCacheService,
    private readonly r2: R2StorageService,
    private readonly storefrontRevalidate: StorefrontRevalidateService,
  ) {}

  async uploadShopLogo(
    file: UploadedImageFile,
    shopId: string,
  ): Promise<StatusBaseResponseDTO> {
    const settings = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
      select: { logoUrl: true },
    });
    if (!settings) {
      throw new NotFoundException(resourceNotFound('Store settings'));
    }

    const processed = await processStoreImage(file, {
      maxEdge: MAX_LOGO_EDGE,
      fit: 'cover',
    });
    const key = `shops-logos/${shopId}/${randomUUID()}.${processed.ext}`;
    const url = await this.r2.put(key, processed.buffer, processed.contentType);
    const previousUrl = settings.logoUrl;

    try {
      await this.prisma.shopStoreSettings.update({
        where: { shopId },
        data: { logoUrl: url },
      });
    } catch (error) {
      await this.r2.deleteByUrl(url);
      throw error;
    }

    if (previousUrl) {
      await this.r2.deleteByUrl(previousUrl);
    }

    this.cache.clear();
    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(true, 'Shop logo uploaded successfully');
  }

  async removeShopLogo(shopId: string): Promise<StatusBaseResponseDTO> {
    const settings = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
      select: { logoUrl: true },
    });
    if (!settings) {
      throw new NotFoundException(resourceNotFound('Store settings'));
    }

    await this.prisma.shopStoreSettings.update({
      where: { shopId },
      data: { logoUrl: null },
    });

    if (settings.logoUrl) {
      await this.r2.deleteByUrl(settings.logoUrl);
    }

    this.cache.clear();
    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(true, 'Shop logo removed successfully');
  }

  async uploadShopBanner(
    file: UploadedImageFile,
    shopId: string,
  ): Promise<StatusBaseResponseDTO> {
    const settings = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
      select: { bannerUrl: true },
    });
    if (!settings) {
      throw new NotFoundException(resourceNotFound('Store settings'));
    }

    const processed = await processStoreImage(file, {
      width: BANNER_WIDTH,
      height: BANNER_HEIGHT,
      fit: 'cover',
    });
    const key = `shops-banners/${shopId}/${randomUUID()}.${processed.ext}`;
    const url = await this.r2.put(key, processed.buffer, processed.contentType);
    const previousUrl = settings.bannerUrl;

    try {
      await this.prisma.shopStoreSettings.update({
        where: { shopId },
        data: { bannerUrl: url },
      });
    } catch (error) {
      await this.r2.deleteByUrl(url);
      throw error;
    }

    if (previousUrl) {
      await this.r2.deleteByUrl(previousUrl);
    }

    this.cache.clear();
    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(true, 'Shop banner uploaded successfully');
  }

  async removeShopBanner(shopId: string): Promise<StatusBaseResponseDTO> {
    const settings = await this.prisma.shopStoreSettings.findUnique({
      where: { shopId },
      select: { bannerUrl: true },
    });
    if (!settings) {
      throw new NotFoundException(resourceNotFound('Store settings'));
    }

    await this.prisma.shopStoreSettings.update({
      where: { shopId },
      data: { bannerUrl: null },
    });

    if (settings.bannerUrl) {
      await this.r2.deleteByUrl(settings.bannerUrl);
    }

    this.cache.clear();
    this.storefrontRevalidate.invalidateShopById(shopId);
    return new StatusBaseResponseDTO(true, 'Shop banner removed successfully');
  }
}
