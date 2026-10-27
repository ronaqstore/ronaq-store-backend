import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Query,
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
  OK_RESPONSE_STATUS,
  UNAUTHORIZED_REQUEST_RESPONSE,
} from '../../constants/error-response.constant.js';
import { PlatformAdminGuard } from '../../auth-guards/platform-admin.guard.js';
import { ApiSuccessResponseDTO } from '../../common-dto/response/api-success-response.dto.js';
import { logError } from '../../helpers/logger-helper.js';
import { DashboardPlatformService } from '../services/dashboard-platform.service.js';
import { PlatformDashboardQueryDto } from '../dto/platform/platform-dashboard-query.dto.js';
import {
  ActivityResponseDto,
  AtRiskResponseDto,
  OnboardingFunnelResponseDto,
  PlatformKpisDto,
  RenewalsResponseDto,
  ShopGrowthResponseDto,
  ShopsByCityResponseDto,
} from '../dto/platform/platform-dashboard-responses.dto.js';

@ApiTags('platform-dashboard')
@Controller('platform/dashboard')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
export class DashboardPlatformController {
  constructor(private readonly platformService: DashboardPlatformService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Platform shop KPI snapshot' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(PlatformKpisDto, 'Platform KPIs'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getKpis(): Promise<ApiSuccessResponseDTO<PlatformKpisDto>> {
    try {
      const data = await this.platformService.getKpis();
      return new ApiSuccessResponseDTO(
        'Platform KPIs fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-platform.controller.ts', 'getKpis', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch platform KPIs');
    }
  }

  @Get('shop-growth')
  @ApiOperation({ summary: 'New shops per month + cumulative' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ShopGrowthResponseDto, 'Shop growth'),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getShopGrowth(
    @Query() query: PlatformDashboardQueryDto,
  ): Promise<ApiSuccessResponseDTO<ShopGrowthResponseDto>> {
    try {
      const data = await this.platformService.getShopGrowth(query);
      return new ApiSuccessResponseDTO(
        'Shop growth fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-platform.controller.ts', 'getShopGrowth', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch shop growth');
    }
  }

  @Get('renewals')
  @ApiOperation({ summary: 'Subscription renewals pipeline' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(RenewalsResponseDto, 'Renewals'),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getRenewals(
    @Query() query: PlatformDashboardQueryDto,
  ): Promise<ApiSuccessResponseDTO<RenewalsResponseDto>> {
    try {
      const data = await this.platformService.getRenewals(query);
      return new ApiSuccessResponseDTO('Renewals fetched successfully', data);
    } catch (error) {
      logError('dashboard-platform.controller.ts', 'getRenewals', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch renewals');
    }
  }

  @Get('onboarding-funnel')
  @ApiOperation({ summary: 'Shop onboarding funnel (monotonic)' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(OnboardingFunnelResponseDto, 'Onboarding funnel'),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getOnboardingFunnel(): Promise<
    ApiSuccessResponseDTO<OnboardingFunnelResponseDto>
  > {
    try {
      const data = await this.platformService.getOnboardingFunnel();
      return new ApiSuccessResponseDTO(
        'Onboarding funnel fetched successfully',
        data,
      );
    } catch (error) {
      logError(
        'dashboard-platform.controller.ts',
        'getOnboardingFunnel',
        error,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch onboarding funnel',
      );
    }
  }

  @Get('shops-by-city')
  @ApiOperation({ summary: 'Shops grouped by city' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ShopsByCityResponseDto, 'Shops by city'),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getShopsByCity(
    @Query() query: PlatformDashboardQueryDto,
  ): Promise<ApiSuccessResponseDTO<ShopsByCityResponseDto>> {
    try {
      const data = await this.platformService.getShopsByCity(query);
      return new ApiSuccessResponseDTO(
        'Shops by city fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-platform.controller.ts', 'getShopsByCity', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch shops by city');
    }
  }

  @Get('activity')
  @ApiOperation({ summary: 'Platform sales activity by day' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ActivityResponseDto, 'Platform activity'),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getActivity(
    @Query() query: PlatformDashboardQueryDto,
  ): Promise<ApiSuccessResponseDTO<ActivityResponseDto>> {
    try {
      const data = await this.platformService.getActivity(query);
      return new ApiSuccessResponseDTO(
        'Platform activity fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-platform.controller.ts', 'getActivity', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch platform activity',
      );
    }
  }

  @Get('at-risk')
  @ApiOperation({ summary: 'ACTIVE shops with no sale in 14 days' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(AtRiskResponseDto, 'At-risk shops'),
  )
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getAtRisk(
    @Query() query: PlatformDashboardQueryDto,
  ): Promise<ApiSuccessResponseDTO<AtRiskResponseDto>> {
    try {
      const data = await this.platformService.getAtRisk(query);
      return new ApiSuccessResponseDTO(
        'At-risk shops fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-platform.controller.ts', 'getAtRisk', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch at-risk shops');
    }
  }
}
