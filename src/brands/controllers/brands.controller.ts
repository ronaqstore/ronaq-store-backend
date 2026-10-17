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
import { BrandsService } from '../services/brands.service.js';
import { CreateBrandDto } from '../dto/create-brand.dto.js';
import { UpdateBrandDto } from '../dto/update-brand.dto.js';
import { BrandQueryFilterDto } from '../dto/brand-query.filter.js';
import { ResponseBrandDto } from '../dto/response-brand.dto.js';

@ApiTags('brands')
@Controller('brands')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post('/')
  @ApiOperation({
    summary: 'Create a brand',
    description:
      'Creates one brand for the shop in the JWT. Name must be unique inside this shop (case-sensitive).',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(StatusBaseResponseDTO, 'Brand created successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async createBrand(
    @Body() createBrandDto: CreateBrandDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.brandsService.createBrand(
        createBrandDto,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO('Brand created successfully', res);
    } catch (error) {
      logError('brands.controller.ts', 'createBrand', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to create brand');
    }
  }

  @Get('/')
  @ApiOperation({
    summary: 'List brands',
    description:
      'Paginated list of brands for the shop in the JWT. Supports search, isActive filter and sort.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(PaginatedResponseDTO, 'Brands fetched successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getBrands(
    @Query() query: BrandQueryFilterDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseBrandDto>>> {
    try {
      const res = await this.brandsService.getBrands(query, req.user.shopId);
      return new ApiSuccessResponseDTO('Brands fetched successfully', res);
    } catch (error) {
      logError('brands.controller.ts', 'getBrands', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch brands');
    }
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get one brand by id' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ResponseBrandDto, 'Brand fetched successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getBrandById(
    @Param('id') id: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseBrandDto>> {
    try {
      const res = await this.brandsService.getBrandById(id, req.user.shopId);
      return new ApiSuccessResponseDTO('Brand fetched successfully', res);
    } catch (error) {
      logError('brands.controller.ts', 'getBrandById', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch brand');
    }
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Update a brand' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(StatusBaseResponseDTO, 'Brand updated successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async updateBrand(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.brandsService.updateBrand(
        id,
        updateBrandDto,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO('Brand updated successfully', res);
    } catch (error) {
      logError('brands.controller.ts', 'updateBrand', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update brand');
    }
  }

  @Delete('/:id')
  @ApiOperation({
    summary: 'Deactivate a brand',
    description: 'Soft-deletes by setting isActive to false.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(StatusBaseResponseDTO, 'Brand deactivated successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async deleteBrand(
    @Param('id') id: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.brandsService.deleteBrand(
        id,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO('Brand deactivated successfully', res);
    } catch (error) {
      logError('brands.controller.ts', 'deleteBrand', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to deactivate brand');
    }
  }
}
