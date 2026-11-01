import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponseDecorator } from '../../common-dto/decorator/ApiSuccessResponseDecorator.js';
import {
  BAD_REQUEST_RESPONSE,
  INTERNAL_SERVER_ERROR_RESPONSE,
  NOT_FOUND_REQUEST_RESPONSE,
  OK_RESPONSE_STATUS,
  UNAUTHORIZED_REQUEST_RESPONSE,
} from '../../constants/error-response.constant.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';
import { ApiSuccessResponseDTO } from '../../common-dto/response/api-success-response.dto.js';
import { StatusBaseResponseDTO } from '../../common-dto/response/status-base-response.dto.js';
import { PaginatedResponseDTO } from '../../common-dto/response/paginated-response.dto.js';
import { PurchaseOverdraftResponseDto } from '../../purchases/dto/overdraft-response.dto.js';
import {
  ConsignmentsService,
  SettleConsignmentResult,
} from '../services/consignments.service.js';
import { CreateConsignmentDto } from '../dto/create-consignment.dto.js';
import { SettleConsignmentDto } from '../dto/settle-consignment.dto.js';
import { ReturnConsignmentDto } from '../dto/return-consignment.dto.js';
import { CancelConsignmentDto } from '../dto/cancel-consignment.dto.js';
import { ConsignmentQueryFilterDto } from '../dto/consignment-query.filter.js';
import { ResponseConsignmentDto } from '../dto/response-consignment.dto.js';
import { logError } from '../../helpers/logger-helper.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';

@ApiTags('consignments')
@Controller('consignments')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ConsignmentsController {
  constructor(private readonly consignmentsService: ConsignmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Record a new consignment agreement (take phone into custody)',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Consignment recorded successfully',
    ),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async createConsignment(
    @Body() dto: CreateConsignmentDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.consignmentsService.createConsignment(
        dto,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO(res.message, res);
    } catch (error) {
      logError('consignments.controller.ts', 'createConsignment', error, {
        shopId: req.user?.shopId,
        clientRequestId: dto?.clientRequestId,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create consignment');
    }
  }

  @Get()
  @ApiOperation({ summary: 'List consignment agreements for the shop' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      PaginatedResponseDTO,
      'Consignments fetched successfully',
    ),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async listConsignments(
    @Query() filter: ConsignmentQueryFilterDto,
    @Req() req: OwnerRequest,
  ): Promise<
    ApiSuccessResponseDTO<PaginatedResponseDTO<ResponseConsignmentDto>>
  > {
    try {
      const res = await this.consignmentsService.listConsignments(
        filter,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Consignments fetched successfully',
        res,
      );
    } catch (error) {
      logError('consignments.controller.ts', 'listConsignments', error, {
        shopId: req.user?.shopId,
        filter,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch consignments');
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a single consignment agreement' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ResponseConsignmentDto,
      'Consignment fetched successfully',
    ),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getConsignmentById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseConsignmentDto>> {
    try {
      const res = await this.consignmentsService.getConsignmentById(
        id,
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO('Consignment fetched successfully', res);
    } catch (error) {
      logError('consignments.controller.ts', 'getConsignmentById', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch consignment');
    }
  }

  @Post(':id/return')
  @ApiOperation({
    summary: 'Return a consignment phone back to the original owner',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Consignment returned successfully',
    ),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async returnConsignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnConsignmentDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.consignmentsService.returnConsignment(
        id,
        dto,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO(res.message, res);
    } catch (error) {
      logError('consignments.controller.ts', 'returnConsignment', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to return consignment');
    }
  }

  @Post(':id/settle')
  @ApiOperation({
    summary: 'Disburse payout to the owner after the phone is sold',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Consignment settled successfully',
    ),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async settleConsignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleConsignmentDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<SettleConsignmentResult>> {
    try {
      const result = await this.consignmentsService.settleConsignment(
        id,
        dto,
        req.user.shopId,
        req.user.userId,
      );
      if (result instanceof PurchaseOverdraftResponseDto) {
        return new ApiSuccessResponseDTO(result.message, result);
      }
      return new ApiSuccessResponseDTO(result.message, result);
    } catch (error) {
      logError('consignments.controller.ts', 'settleConsignment', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to settle consignment');
    }
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel / void an active consignment intake' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      StatusBaseResponseDTO,
      'Consignment cancelled successfully',
    ),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async cancelConsignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelConsignmentDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<StatusBaseResponseDTO>> {
    try {
      const res = await this.consignmentsService.cancelConsignment(
        id,
        dto,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO(res.message, res);
    } catch (error) {
      logError('consignments.controller.ts', 'cancelConsignment', error, {
        shopId: req.user?.shopId,
        id,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to cancel consignment');
    }
  }
}
