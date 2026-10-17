import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  FileInterceptor,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiSuccessResponseDecorator,
  BAD_REQUEST_RESPONSE,
  INTERNAL_SERVER_ERROR_RESPONSE,
  NOT_FOUND_REQUEST_RESPONSE,
  OK_RESPONSE_STATUS,
  UNAUTHORIZED_REQUEST_RESPONSE,
  AuthGuard,
  ApiSuccessResponseDTO,
  StatusBaseResponseDTO,
  logError,
} from '../helpers/store-controller.imports.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';
import { photoFileRequired } from '../../errors/error.builder.js';
import { StoreService } from '../services/store.service.js';
import { UpdateStoreSettingsDto } from '../dto/update-store-settings.dto.js';
import { ResponseStoreSettingsDto } from '../dto/response-store-settings.dto.js';
import type { UploadedImageFile } from '../dto/uploaded-image-file.type.js';

@ApiTags('store')
@Controller('store')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('/settings')
  @ApiOperation({
    summary: 'Get store settings',
    description:
      "Returns this shop's store settings. 404 when the shop has not configured a store yet (create one with PATCH /store/settings).",
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseStoreSettingsDto,
      'Store settings fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async getSettings(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreSettingsDto>> {
    try {
      const res = await this.storeService.getSettings(req.user.shopId);
      return new ApiSuccessResponseDTO(
        'Store settings fetched successfully',
        res,
      );
    } catch (error) {
      logError('store.controller.ts', 'getSettings', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch store settings');
    }
  }

  @Patch('/settings')
  @ApiOperation({
    summary: 'Create or update store settings',
    description:
      "Upserts the shop's store settings. When the shop has none yet, a row is created (displayName defaults to the shop name). Sending null on displayName or slug is a 400.",
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Store settings updated successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async updateSettings(
    @Body() updateStoreSettingsDto: UpdateStoreSettingsDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.storeService.updateSettings(
        updateStoreSettingsDto,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO(
        'Store settings updated successfully',
        res,
      );
    } catch (error) {
      logError('store.controller.ts', 'updateSettings', error, {
        shopId: req.user?.shopId,
        dto: updateStoreSettingsDto,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update store settings');
    }
  }

  @Post('/settings/logo')
  @ApiOperation({
    summary: 'Upload shop logo',
    description:
      'Optional shop logo. Multipart field "image" (JPEG/PNG/WebP). Stored under shops-logos/ in R2 and saved on store settings.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Logo file (JPEG, PNG or WebP), named "image"',
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Shop logo uploaded successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async uploadLogo(
    @UploadedFile() file: UploadedImageFile,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      if (!file || !file.buffer) {
        throw new BadRequestException(photoFileRequired());
      }
      const res = await this.storeService.uploadShopLogo(file, req.user.shopId);
      return new ApiSuccessResponseDTO('Shop logo uploaded successfully', res);
    } catch (error) {
      logError('store.controller.ts', 'uploadLogo', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to upload shop logo');
    }
  }

  @Delete('/settings/logo')
  @ApiOperation({
    summary: 'Remove shop logo',
    description:
      'Clears the shop logo from settings and deletes the R2 object.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(StatusBaseResponseDTO, 'Shop logo removed successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async removeLogo(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.storeService.removeShopLogo(req.user.shopId);
      return new ApiSuccessResponseDTO('Shop logo removed successfully', res);
    } catch (error) {
      logError('store.controller.ts', 'removeLogo', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove shop logo');
    }
  }

  @Post('/products/:id/publish')
  @ApiOperation({
    summary: 'Publish a product',
    description:
      'Makes an ACTIVE product visible in the public store. The DB trigger backfills publishedAt. Only active products can be published.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(StatusBaseResponseDTO, 'Product published successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async publishProduct(
    @Param('id') id: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.storeService.publishProduct(id, req.user.shopId);
      return new ApiSuccessResponseDTO('Product published successfully', res);
    } catch (error) {
      logError('store.controller.ts', 'publishProduct', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to publish product');
    }
  }

  @Post('/products/:id/unpublish')
  @ApiOperation({
    summary: 'Unpublish a product',
    description:
      'Hides a product from the public store. The DB trigger clears publishedAt.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Product unpublished successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async unpublishProduct(
    @Param('id') id: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.storeService.unpublishProduct(id, req.user.shopId);
      return new ApiSuccessResponseDTO('Product unpublished successfully', res);
    } catch (error) {
      logError('store.controller.ts', 'unpublishProduct', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to unpublish product');
    }
  }
}
