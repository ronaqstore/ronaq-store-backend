import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { ApiSuccessResponseDTO } from '../../common-dto/response/api-success-response.dto.js';
import {
  BAD_REQUEST_RESPONSE,
  INTERNAL_SERVER_ERROR_RESPONSE,
  NOT_FOUND_REQUEST_RESPONSE,
  OK_RESPONSE_STATUS,
  UNAUTHORIZED_REQUEST_RESPONSE,
} from '../../constants/error-response.constant.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';
import { RolesGuard } from '../../auth-guards/roles.guard.js';
import { Roles } from '../../auth-guards/roles.decorator.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { logError } from '../../helpers/logger-helper.js';
import { StaffService } from '../services/staff.service.js';
import { CreateStaffDto } from '../dto/create-staff.dto.js';
import { UpdateStaffDto } from '../dto/update-staff.dto.js';
import { ResponseStaffDto } from '../dto/response-staff.dto.js';

@ApiTags('staff')
@Controller('staff')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('/')
  @ApiOperation({
    summary: 'List all staff members of the store',
    description:
      'Returns all user accounts (Owner, Manager, Salesman) for this shop. Restricted to OWNER.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ResponseStaffDto, 'Staff list retrieved successfully'),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async listStaff(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseStaffDto[]>> {
    try {
      const staff = await this.staffService.listStaff(req.user.shopId);
      return new ApiSuccessResponseDTO('Staff list retrieved', staff);
    } catch (error) {
      logError('staff.controller.ts', 'listStaff', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to list staff');
    }
  }

  @Post('/')
  @ApiOperation({
    summary: 'Create a new staff user (Manager or Salesman)',
    description:
      'Creates a staff user account with credentials. Restricted to OWNER.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ResponseStaffDto, 'Staff created successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async createStaff(
    @Body() dto: CreateStaffDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseStaffDto>> {
    try {
      const created = await this.staffService.createStaff(req.user.shopId, dto);
      return new ApiSuccessResponseDTO(
        'Staff user created successfully',
        created,
      );
    } catch (error) {
      logError('staff.controller.ts', 'createStaff', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to create staff');
    }
  }

  @Patch('/:id')
  @ApiOperation({
    summary: 'Update a staff member details, role, status, or reset password',
    description:
      'Updates staff attributes. Demoting or suspending OWNER is blocked. Restricted to OWNER.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ResponseStaffDto, 'Staff updated successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async updateStaff(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStaffDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ResponseStaffDto>> {
    try {
      const updated = await this.staffService.updateStaff(
        id,
        req.user.shopId,
        dto,
      );
      return new ApiSuccessResponseDTO(
        'Staff user updated successfully',
        updated,
      );
    } catch (error) {
      logError('staff.controller.ts', 'updateStaff', error, {
        shopId: req.user?.shopId,
        staffId: id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update staff');
    }
  }

  @Delete('/:id')
  @ApiOperation({
    summary: 'Suspend/delete a staff member',
    description:
      'Suspends a staff member account. Cannot delete yourself or the shop OWNER. Restricted to OWNER.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(Object, 'Staff suspended successfully'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(NOT_FOUND_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async deleteStaff(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<{ success: boolean; message: string }>> {
    try {
      const result = await this.staffService.deleteStaff(
        id,
        req.user.shopId,
        req.user.userId,
      );
      return new ApiSuccessResponseDTO(result.message, result);
    } catch (error) {
      logError('staff.controller.ts', 'deleteStaff', error, {
        shopId: req.user?.shopId,
        staffId: id,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to suspend staff');
    }
  }
}
