import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
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
  StatusBaseResponseDTO,
  PaginatedResponseDTO,
  logError,
} from '../../helpers/crud-controller.imports.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';
import { ProductsService } from '../services/products.service.js';
import { CreateProductDto } from '../dto/create-product.dto.js';
import { UpdateProductDto } from '../dto/update-product.dto.js';
import { BulkPublishProductsDto } from '../dto/bulk-publish-products.dto.js';
import { ProductQueryFilterDto } from '../dto/product-query.filter.js';
import { ResponseProductDto } from '../dto/response-product.dto.js';

@ApiTags('products')
@Controller('products')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('/')
  @ApiOperation({
    summary: 'Create a product',
    description:
      'Creates one product for the shop in the JWT. categoryId and brandId must belong to that shop. A QUANTITY product also gets its stock_levels row (quantity 0) in the same transaction; a SERIALIZED product does not. All prices are integers in PAISA.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(StatusBaseResponseDTO, 'Product created successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.productsService.createProduct(
        createProductDto,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO('Product created successfully', res);
    } catch (error) {
      logError('products.controller.ts', 'createProduct', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  @Get('/')
  @ApiOperation({
    summary: 'List products',
    description:
      'Paginated list scoped to the shop in the JWT. Supports a contains search across name/model/sku/barcode, plus categoryId, brandId, trackingType and isActive filters. Each row carries categoryName, brandName and the live quantityOnHand.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(PaginatedResponseDTO, 'Products fetched successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async getProducts(
    @Query() query: ProductQueryFilterDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseProductDto>>> {
    try {
      const res = await this.productsService.getProducts(
        query,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO('Products fetched successfully', res);
    } catch (error) {
      logError('products.controller.ts', 'getProducts', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch products');
    }
  }

  @Get('/:id')
  @ApiOperation({
    summary: 'Get one product by id',
    description:
      'Returns a single product with its category name, brand name and live quantityOnHand. Returns 404 if it does not exist or belongs to another shop.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ResponseProductDto, 'Product fetched successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async getProductById(
    @Param('id') id: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseProductDto>> {
    try {
      const res = await this.productsService.getProductById(
        id,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO('Product fetched successfully', res);
    } catch (error) {
      logError('products.controller.ts', 'getProductById', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch product');
    }
  }

  @Patch('/publish')
  @ApiOperation({
    summary: 'Bulk publish or unpublish products (WF20)',
    description:
      'One transaction flips is_published for every id in the list. Every id must belong to the shop in the JWT (404 otherwise) and an inactive product cannot be published. The DB trigger maintains publishedAt.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(StatusBaseResponseDTO, 'Products updated successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async publishProducts(
    @Body() bulkPublishProductsDto: BulkPublishProductsDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.productsService.publishProducts(
        bulkPublishProductsDto,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO('Products updated successfully', res);
    } catch (error) {
      logError('products.controller.ts', 'publishProducts', error, {
        shopId: req.user?.shopId,
        ids: bulkPublishProductsDto.ids,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update products');
    }
  }

  @Patch('/:id')
  @ApiOperation({
    summary: 'Update a product',
    description:
      'Partial update. Only the fields you send are changed. trackingType may change only while the product has no purchase and no sale history; switching to SERIALIZED additionally requires an empty stock counter. Release 1.2 also accepts isPublished, publicDescription, contactForPrice and ptaStatus.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(StatusBaseResponseDTO, 'Product updated successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.productsService.updateProduct(
        id,
        updateProductDto,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO('Product updated successfully', res);
    } catch (error) {
      logError('products.controller.ts', 'updateProduct', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update product');
    }
  }

  @Delete('/:id')
  @ApiOperation({
    summary: 'Deactivate a product',
    description:
      'Soft delete. Sets isActive to false and keeps the row so historical purchases and sales keep their product. Nothing is ever removed.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Product deactivated successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  async deleteProduct(
    @Param('id') id: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.productsService.deleteProduct(
        id,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO('Product deactivated successfully', res);
    } catch (error) {
      logError('products.controller.ts', 'deleteProduct', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to deactivate product');
    }
  }
}
