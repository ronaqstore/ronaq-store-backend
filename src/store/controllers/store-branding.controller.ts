import {
  BadRequestException,
  Controller,
  Delete,
  HttpException,
  InternalServerErrorException,
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
import { StoreBrandingService } from '../services/store-branding.service.js';
import type { UploadedImageFile } from '../dto/uploaded-image-file.type.js';

@ApiTags('store')
@Controller('store')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StoreBrandingController {
  constructor(private readonly brandingService: StoreBrandingService) {}

  @Post('/settings/logo')
  @ApiOperation({
    summary: 'Upload shop logo',
    description:
      'Optional shop logo. Multipart field "image" (JPEG/PNG/WebP). Center-cropped to a square for circular display, stored under shops-logos/ in R2.',
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
      const res = await this.brandingService.uploadShopLogo(
        file,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO('Shop logo uploaded successfully', res);
    } catch (error) {
      logError('store-branding.controller.ts', 'uploadLogo', error, {
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
      const res = await this.brandingService.removeShopLogo(req.user.shopId);
      return new ApiSuccessResponseDTO('Shop logo removed successfully', res);
    } catch (error) {
      logError('store-branding.controller.ts', 'removeLogo', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove shop logo');
    }
  }

  @Post('/settings/banner')
  @ApiOperation({
    summary: 'Upload shop banner',
    description:
      'Optional cover banner for the public shop page. Multipart field "image" (JPEG/PNG/WebP). Cropped to a wide cover ratio and stored under shops-banners/ in R2.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Banner file (JPEG, PNG or WebP), named "image"',
    schema: {
      type: 'object',
      properties: {
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Shop banner uploaded successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async uploadBanner(
    @UploadedFile() file: UploadedImageFile,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      if (!file || !file.buffer) {
        throw new BadRequestException(photoFileRequired());
      }
      const res = await this.brandingService.uploadShopBanner(
        file,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Shop banner uploaded successfully',
        res,
      );
    } catch (error) {
      logError('store-branding.controller.ts', 'uploadBanner', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to upload shop banner');
    }
  }

  @Delete('/settings/banner')
  @ApiOperation({
    summary: 'Remove shop banner',
    description:
      'Clears the shop banner from settings and deletes the R2 object.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Shop banner removed successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async removeBanner(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.brandingService.removeShopBanner(req.user.shopId);
      return new ApiSuccessResponseDTO('Shop banner removed successfully', res);
    } catch (error) {
      logError('store-branding.controller.ts', 'removeBanner', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to remove shop banner');
    }
  }
}
