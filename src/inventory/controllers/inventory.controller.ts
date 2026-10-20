import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
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
import type { Response } from 'express';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';
import {
  InventoryService,
  InventoryAdjustmentOutcome,
} from '../services/inventory.service.js';
import { CreateInventoryAdjustmentDto } from '../dto/create-inventory-adjustment.dto.js';
import { InventoryAdjustmentQueryFilterDto } from '../dto/inventory-adjustment-query.filter.js';
import { InventoryUnitQueryFilterDto } from '../dto/inventory-unit-query.filter.js';
import { ResponseInventoryUnitDto } from '../dto/response-inventory-unit.dto.js';
import {
  PaginatedInventoryMovementDto,
  ResponseInventoryMovementDto,
} from '../dto/response-inventory-movement.dto.js';
@ApiTags('inventory')
@Controller('inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('/units')
  @ApiOperation({
    summary: 'List phone units for a product',
    description:
      'Returns inventory units (id, IMEI, cost, status, condition, supplier/purchase/sale info) for the given product.',
  })
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
  ): Promise<ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseInventoryUnitDto>>> {
    try {
      const units = await this.inventoryService.listUnits(
        query,
        req.user.shopId,
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

  @Post('/adjustments')
  @ApiOperation({
    summary: 'Record a manual stock change (adjust / damaged / lost)',
    description:
      'WF8 — one change in ONE transaction: append an inventory_movements row and move the current-value row. ' +
      'Accessories (QUANTITY): ADJUSTMENT sets the shelf to countedQuantity and stores counted − system ' +
      '(201 with quantityChange = 0 is impossible — matching count returns 200 nothing-written); ' +
      'DAMAGED/LOST subtracts atomically and can never drive the count below zero. ' +
      'Phones (SERIALIZED): DAMAGED/LOST flips one IN_STOCK unit so it can never be sold; ADJUSTMENT is refused. ' +
      'reason is mandatory for every change.',
  })
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
  @ApiOperation({
    summary: 'List manual stock changes',
    description:
      'Paginated history of stock adjustments and write-offs, scoped to the shop in the JWT. ' +
      'Defaults to manual changes (ADJUSTMENT/DAMAGED/LOST) only — purchase and sale movements belong to the ledger, not this screen. ' +
      'Filter by type, product, a createdAt date range and/or a search term that matches the product name or the reason.',
  })
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
