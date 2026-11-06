import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
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
} from '../../helpers/document-controller.imports.js';
import { RolesGuard } from '../../auth-guards/roles.guard.js';
import { Roles } from '../../auth-guards/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { ParseUUIDPipe } from '@nestjs/common';
import type { Response } from 'express';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';
import {
  InventoryService,
  InventoryAdjustmentOutcome,
} from '../services/inventory.service.js';
import { ImeiLookupService } from '../services/imei-lookup.service.js';
import { DeadStockReportService } from '../services/dead-stock-report.service.js';
import {
  DeadStockQueryFilterDto,
  ResponseDeadStockReportDto,
  CreateInventoryAdjustmentDto,
  UpdateInventoryUnitDto,
  InventoryAdjustmentQueryFilterDto,
  InventoryUnitQueryFilterDto,
  ResponseInventoryUnitDto,
  PaginatedInventoryMovementDto,
  ResponseInventoryMovementDto,
  ResolveScanQueryDto,
  ResponseResolveScanDto,
  ImeiLookupQueryDto,
  ResponseImeiLookupDto,
} from '../dto/inventory-dtos.js';
@ApiTags('inventory')
@Controller('inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly imeiLookupService: ImeiLookupService,
    private readonly deadStockReportService: DeadStockReportService,
  ) {}

  @Get('/resolve-scan')
  @ApiOperation({ summary: 'Resolve scan to in-stock unit or product' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseResolveScanDto,
      'Scan result resolved successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async resolveScan(
    @Query() query: ResolveScanQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseResolveScanDto>> {
    try {
      const result = await this.inventoryService.resolveScan(
        query.code,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Scan result resolved successfully',
        result,
      );
    } catch (error) {
      logError('inventory.controller.ts', 'resolveScan', error, {
        shopId: req.user?.shopId,
        code: query?.code,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to resolve scanned item');
    }
  }

  @Get('/imei-lookup')
  @ApiOperation({
    summary: 'Lookup 360-degree lifecycle history of an IMEI',
    description:
      'Phone specifications, intake source, sale history, warranty status, profit, and movement timeline.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseImeiLookupDto,
      'IMEI lookup retrieved successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async lookupImei(
    @Query() query: ImeiLookupQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseImeiLookupDto>> {
    try {
      const result = await this.imeiLookupService.lookupImei(
        query.imei,
        req.user.shopId,
        req.user.role,
      );
      return new ApiSuccessResponseDTO(
        'IMEI lookup retrieved successfully',
        result,
      );
    } catch (error) {
      logError('inventory.controller.ts', 'lookupImei', error, {
        shopId: req.user?.shopId,
        imei: query?.imei,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to lookup IMEI');
    }
  }

  @Get('/dead-stock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Dead stock aging report for serialized devices' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseDeadStockReportDto,
      'Dead stock report retrieved successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getDeadStockReport(
    @Query() query: DeadStockQueryFilterDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseDeadStockReportDto>> {
    try {
      const data = await this.deadStockReportService.getDeadStockReport(
        query,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Dead stock report retrieved successfully',
        data,
      );
    } catch (error) {
      logError('inventory.controller.ts', 'getDeadStockReport', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch dead stock report',
      );
    }
  }

  @Get('/units')
  @ApiOperation({ summary: 'List phone units for a product' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      PaginatedResponseDTO,
      'Inventory units fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async listUnits(
    @Query() query: InventoryUnitQueryFilterDto,
    @Req() req: OwnerRequest,
  ): Promise<
    ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseInventoryUnitDto>>
  > {
    try {
      const units = await this.inventoryService.listUnits(
        query,
        req.user.shopId,
        req.user.role,
      );
      return new ApiSuccessResponseDTO(
        'Inventory units fetched successfully',
        units,
      );
    } catch (error) {
      logError('inventory.controller.ts', 'listUnits', error, {
        shopId: req.user?.shopId,
        productId: query?.productId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch inventory units');
    }
  }

  @Patch('/units/:id')
  @ApiOperation({ summary: 'Update inventory unit metadata' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseInventoryUnitDto,
      'Inventory unit updated successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async updateUnit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateInventoryUnitDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseInventoryUnitDto>> {
    try {
      const unit = await this.inventoryService.updateUnit(
        id,
        dto,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Inventory unit updated successfully',
        unit,
      );
    } catch (error) {
      logError('inventory.controller.ts', 'updateUnit', error, {
        shopId: req.user?.shopId,
        unitId: id,
        dto,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update inventory unit');
    }
  }

  @Post('/adjustments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Record a manual stock change' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Stock change recorded successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async createAdjustment(
    @Body() dto: CreateInventoryAdjustmentDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponseDTO<InventoryAdjustmentOutcome>> {
    try {
      const result = await this.inventoryService.createAdjustment(
        dto,
        req.user.shopId,
      );
      res.status(result.kind === 'created' ? 201 : 200);
      return new ApiSuccessResponseDTO(result.message, result);
    } catch (error) {
      logError('inventory.controller.ts', 'createAdjustment', error, {
        shopId: req.user?.shopId,
        productId: dto?.productId,
        type: dto?.type,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to record inventory adjustment',
      );
    }
  }

  @Get('/adjustments')
  @ApiOperation({ summary: 'List manual stock changes' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      PaginatedInventoryMovementDto,
      'Inventory adjustments fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getAdjustments(
    @Query() query: InventoryAdjustmentQueryFilterDto,
    @Req() req: OwnerRequest,
  ): Promise<
    ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseInventoryMovementDto>>
  > {
    try {
      const res = await this.inventoryService.getInventoryMovements(
        query,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Inventory adjustments fetched successfully',
        res,
      );
    } catch (error) {
      logError('inventory.controller.ts', 'getAdjustments', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch inventory adjustments',
      );
    }
  }
}
