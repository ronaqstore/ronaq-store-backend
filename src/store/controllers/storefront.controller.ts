import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { RateLimitGuard } from '../guards/rate-limit.guard.js';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDecorator } from '../../common-dto/decorator/ApiSuccessResponseDecorator.js';
import {
  BAD_REQUEST_RESPONSE,
  INTERNAL_SERVER_ERROR_RESPONSE,
  NOT_FOUND_REQUEST_RESPONSE,
  OK_RESPONSE_STATUS,
} from '../../constants/error-response.constant.js';
import { ApiSuccessResponseDTO } from '../../common-dto/response/api-success-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import {
  ResponseStoreDto,
  ResponseStoreProductDto,
  ResponseStoreCategoriesDto,
  ResponseStoreListItemDto,
  ResponseStoreModelDto,
  ResponseStoreModelDetailDto,
} from '../dto/response-storefront.dto.js';
import { StoreProductsQueryDto } from '../dto/store-products-query.dto.js';
import { StoreListQueryDto } from '../dto/store-list-query.dto.js';
import { logError } from '../../helpers/logger-helper.js';
import { StorefrontService } from '../services/storefront.service.js';

const CACHE_CONTROL =
  'public, max-age=0, s-maxage=15, stale-while-revalidate=60';

@ApiTags('storefront')
@Controller('public/stores')
@UseGuards(RateLimitGuard)
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('/')
  @ApiOperation({
    summary: 'Public list of all active stores',
    description:
      'NO authentication. Allows customers to search and discover shops by name, city, location, or product catalog.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(PaginatedResponseDTO, 'Stores fetched successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getStores(
    @Query() query: StoreListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseStoreListItemDto>>
  > {
    try {
      const data = await this.storefrontService.getStores(query);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO('Stores fetched successfully', data);
    } catch (error) {
      logError('storefront.controller.ts', 'getStores', error, { query });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch stores');
    }
  }

  @Get('/:slug')
  @ApiOperation({
    summary: 'Public store profile by slug',
    description:
      "NO authentication. The store's public face: name, about, logo, banner, WhatsApp, address and social links. 404 'Store not available' when the slug is unknown, the store is OFF or the shop is suspended — the three cases are indistinguishable on purpose.",
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ResponseStoreDto, 'Store fetched successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getStore(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreDto>> {
    try {
      const data = await this.storefrontService.getStore(slug);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO('Store fetched successfully', data);
    } catch (error) {
      logError('storefront.controller.ts', 'getStore', error, { slug });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch store');
    }
  }

  @Get('/:slug/categories')
  @ApiOperation({
    summary: 'Categories and brands on the store',
    description:
      'Every category and brand that has at least one published, active product — the filter chips of the store.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseStoreCategoriesDto,
      'Store categories fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getCategories(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreCategoriesDto>> {
    try {
      const data = await this.storefrontService.getCategories(slug);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO(
        'Store categories fetched successfully',
        data,
      );
    } catch (error) {
      logError('storefront.controller.ts', 'getCategories', error, { slug });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch store categories',
      );
    }
  }

  @Get('/:slug/models')
  @ApiOperation({
    summary: 'Phone models grouped for browsing',
    description:
      'SERIALIZED published products grouped by brand + model. Click a model to see color / storage / PTA variants.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseStoreModelDto,
      'Store models fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getModels(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreModelDto[]>> {
    try {
      const data = await this.storefrontService.getModels(slug);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO(
        'Store models fetched successfully',
        data,
      );
    } catch (error) {
      logError('storefront.controller.ts', 'getModels', error, { slug });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch store models');
    }
  }

  @Get('/:slug/models/:modelKey')
  @ApiOperation({
    summary: 'Variants for one phone model',
    description:
      'All published SERIALIZED variants that share the same brand + model (color, storage, PTA, etc.).',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseStoreModelDetailDto,
      'Store model fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getModel(
    @Param('slug') slug: string,
    @Param('modelKey') modelKey: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreModelDetailDto>> {
    try {
      const data = await this.storefrontService.getModel(slug, modelKey);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO(
        'Store model fetched successfully',
        data,
      );
    } catch (error) {
      logError('storefront.controller.ts', 'getModel', error, {
        slug,
        modelKey,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch store model');
    }
  }

  @Get('/:slug/products')
  @ApiOperation({
    summary: 'Published products on the store',
    description:
      'One page of published, ACTIVE products, newest first. Filters: category and brand (id or exact name), q (name contains). limit max 50. Availability comes from stock_levels or a grouped IN_STOCK unit count; exact stockCount only when showExactStock is on.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      PaginatedResponseDTO,
      'Store products fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getProducts(
    @Param('slug') slug: string,
    @Query() query: StoreProductsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseStoreProductDto>>
  > {
    try {
      const data = await this.storefrontService.getProducts(slug, query);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO(
        'Store products fetched successfully',
        data,
      );
    } catch (error) {
      logError('storefront.controller.ts', 'getProducts', error, {
        slug,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch store products');
    }
  }

  @Get('/:slug/products/:productId')
  @ApiOperation({
    summary: 'One product on the store',
    description:
      'A single published, ACTIVE product of this store. A product id from another shop, an unpublished or an inactive product all return the same 404.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseStoreProductDto,
      'Store product fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getProduct(
    @Param('slug') slug: string,
    @Param('productId') productId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponseDTO<ResponseStoreProductDto>> {
    try {
      const data = await this.storefrontService.getProduct(slug, productId);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO(
        'Store product fetched successfully',
        data,
      );
    } catch (error) {
      logError('storefront.controller.ts', 'getProduct', error, {
        slug,
        productId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch store product');
    }
  }
}
