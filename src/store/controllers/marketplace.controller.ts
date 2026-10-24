import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Query,
  Res,
} from '@nestjs/common';
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
import { logError } from '../../helpers/logger-helper.js';
import { MarketplaceService } from '../services/marketplace.service.js';
import { MarketplaceProductsQueryDto } from '../dto/marketplace-products-query.dto.js';
import { MarketplaceHubsQueryDto } from '../dto/marketplace-hubs-query.dto.js';
import { MarketplaceModelsQueryDto } from '../dto/marketplace-models-query.dto.js';
import { MarketplaceRelatedQueryDto } from '../dto/marketplace-related-query.dto.js';
import { NearestHubQueryDto } from '../dto/nearest-hub-query.dto.js';
import {
  ResponseMarketplaceHubDto,
  ResponseMarketplaceProductDto,
} from '../dto/response-marketplace.dto.js';
import { ResponseMarketplaceModelDto } from '../dto/response-marketplace-model.dto.js';

const CACHE_CONTROL =
  'public, max-age=0, s-maxage=15, stale-while-revalidate=60';

@ApiTags('marketplace')
@Controller('public/marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('/hubs')
  @ApiOperation({
    summary: 'Marketplace hub cities (paginated)',
    description:
      'KPK cities/towns for city pickers. Supports search (q) and pagination (page, limit; default 20).',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(PaginatedResponseDTO, 'Hubs fetched successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  listHubs(
    @Query() query: MarketplaceHubsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseMarketplaceHubDto>> {
    try {
      const data = this.marketplaceService.listHubs(query);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO('Hubs fetched successfully', data);
    } catch (error) {
      logError('marketplace.controller.ts', 'listHubs', error, { query });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch hubs');
    }
  }

  @Get('/hubs/nearest')
  @ApiOperation({
    summary: 'Nearest hub from GPS coordinates',
    description:
      'Maps buyer latitude/longitude to the closest marketplace hub city.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseMarketplaceHubDto,
      'Nearest hub resolved successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  nearestHub(
    @Query() query: NearestHubQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): ApiSuccessResponseDTO<ResponseMarketplaceHubDto> {
    try {
      const data = this.marketplaceService.resolveNearestHub(query);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO(
        'Nearest hub resolved successfully',
        data,
      );
    } catch (error) {
      logError('marketplace.controller.ts', 'nearestHub', error, { query });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to resolve nearest hub');
    }
  }

  @Get('/models')
  @ApiOperation({
    summary: 'Marketplace model search suggestions',
    description:
      'Groups matching listings by brand+model for live search (city-scoped). One row per model with count.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseMarketplaceModelDto,
      'Models fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async searchModels(
    @Query() query: MarketplaceModelsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    ApiSuccessResponseDTO<{
      items: ResponseMarketplaceModelDto[];
      total: number;
    }>
  > {
    try {
      const data = await this.marketplaceService.searchModels(query);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO('Models fetched successfully', data);
    } catch (error) {
      logError('marketplace.controller.ts', 'searchModels', error, { query });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to search marketplace models',
      );
    }
  }

  @Get('/products')
  @ApiOperation({
    summary: 'Marketplace product feed',
    description:
      'Published products across enabled shops. Optional city/hub, search, modelKey, category, brand, inStock, condition, price, PTA, authenticity, sort.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      PaginatedResponseDTO,
      'Marketplace products fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async listProducts(
    @Query() query: MarketplaceProductsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseMarketplaceProductDto>>
  > {
    try {
      const data = await this.marketplaceService.listProducts(query);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO(
        'Marketplace products fetched successfully',
        data,
      );
    } catch (error) {
      logError('marketplace.controller.ts', 'listProducts', error, { query });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch marketplace products',
      );
    }
  }

  @Get('/related-products')
  @ApiOperation({
    summary: 'Related accessories for a marketplace product',
    description:
      'For phones/tablets/watches returns covers, chargers, cables and other accessories matched by brand/model, scoped by city hub when provided.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      PaginatedResponseDTO,
      'Related products fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async listRelatedProducts(
    @Query() query: MarketplaceRelatedQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseMarketplaceProductDto>>
  > {
    try {
      const data = await this.marketplaceService.listRelatedProducts(query);
      res.set('Cache-Control', CACHE_CONTROL);
      return new ApiSuccessResponseDTO(
        'Related products fetched successfully',
        data,
      );
    } catch (error) {
      logError('marketplace.controller.ts', 'listRelatedProducts', error, {
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch related products',
      );
    }
  }
}
