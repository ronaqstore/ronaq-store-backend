import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Query,
  Req,
  UseGuards,
  ApiBearerAuth,
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
  PaginatedResponseDTO,
  logError,
  ParseUUIDPipe,
} from '../helpers/store-controller.imports.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';
import { StorefrontService } from '../services/storefront.service.js';
import { StoreProductsQueryDto } from '../dto/store-products-query.dto.js';
import {
  ResponseStoreDto,
  ResponseStoreProductDto,
  ResponseStoreCategoriesDto,
} from '../dto/response-storefront.dto.js';

@ApiTags('store')
@Controller('store')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StorePreviewController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('/preview')
  @ApiOperation({
    summary: 'Preview the public store profile',
    description:
      "Same output as GET /public/stores/{slug} for this shop, even while the store is OFF. Requires the owner's login.",
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ResponseStoreDto, 'Store preview fetched successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async getPreview(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreDto>> {
    try {
      const res = await this.storefrontService.getPreviewStore(req.user.shopId);
      return new ApiSuccessResponseDTO(
        'Store preview fetched successfully',
        res,
      );
    } catch (error) {
      logError('store-preview.controller.ts', 'getPreview', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch store preview');
    }
  }

  @Get('/preview/categories')
  @ApiOperation({
    summary: 'Preview store categories and brands',
    description:
      'Same output as GET /public/stores/{slug}/categories — published, active products only.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseStoreCategoriesDto,
      'Store preview categories fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async getPreviewCategories(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreCategoriesDto>> {
    try {
      const res = await this.storefrontService.getPreviewCategories(
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Store preview categories fetched successfully',
        res,
      );
    } catch (error) {
      logError('store-preview.controller.ts', 'getPreviewCategories', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch store preview categories',
      );
    }
  }

  @Get('/preview/products')
  @ApiOperation({
    summary: 'Preview store products',
    description:
      'Same output as GET /public/stores/{slug}/products — one page of published, active products, newest first.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      PaginatedResponseDTO,
      'Store preview products fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async getPreviewProducts(
    @Query() query: StoreProductsQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<
    ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseStoreProductDto>>
  > {
    try {
      const res = await this.storefrontService.getPreviewProducts(
        req.user.shopId,
        query,
      );
      return new ApiSuccessResponseDTO(
        'Store preview products fetched successfully',
        res,
      );
    } catch (error) {
      logError('store-preview.controller.ts', 'getPreviewProducts', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch store preview products',
      );
    }
  }

  @Get('/preview/products/:productId')
  @ApiOperation({
    summary: 'Preview one store product',
    description:
      'Same output as GET /public/stores/{slug}/products/{productId} for this shop.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseStoreProductDto,
      'Store preview product fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async getPreviewProduct(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreProductDto>> {
    try {
      const res = await this.storefrontService.getPreviewProduct(
        req.user.shopId,
        productId,
      );
      return new ApiSuccessResponseDTO(
        'Store preview product fetched successfully',
        res,
      );
    } catch (error) {
      logError('store-preview.controller.ts', 'getPreviewProduct', error, {
        shopId: req.user?.shopId,
        productId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch store preview product',
      );
    }
  }
}
