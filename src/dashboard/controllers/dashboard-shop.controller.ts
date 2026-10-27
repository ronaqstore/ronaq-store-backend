import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  InternalServerErrorException,
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
  OK_RESPONSE_STATUS,
  UNAUTHORIZED_REQUEST_RESPONSE,
} from '../../constants/error-response.constant.js';
import { AuthGuard } from '../../auth-guards/auth-guard.js';
import type { OwnerRequest } from '../../auth-guards/authenticated-request.js';
import { ApiSuccessResponseDTO } from '../../common-dto/response/api-success-response.dto.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { logError } from '../../helpers/logger-helper.js';
import { DashboardShopService } from '../services/dashboard-shop.service.js';
import { DashboardReceivablesService } from '../services/dashboard-receivables.service.js';
import { DashboardProductsService } from '../services/dashboard-products.service.js';
import { DashboardInventoryService } from '../services/dashboard-inventory.service.js';
import { ShopDashboardQueryDto } from '../dto/shop/shop-dashboard-query.dto.js';
import { ShopKpisResponseDto } from '../dto/shop/shop-kpis.dto.js';
import { SalesTrendResponseDto } from '../dto/shop/sales-trend.dto.js';
import { ProfitWaterfallResponseDto } from '../dto/shop/profit-waterfall.dto.js';
import { CashFlowResponseDto } from '../dto/shop/cash-flow.dto.js';
import { ReceivablesAgingResponseDto } from '../dto/shop/receivables-aging.dto.js';
import { TopProductsResponseDto } from '../dto/shop/top-products.dto.js';
import { SalesMixResponseDto } from '../dto/shop/sales-mix.dto.js';
import { ExpensesByCategoryResponseDto } from '../dto/shop/expenses-by-category.dto.js';
import { InventoryAgingResponseDto } from '../dto/shop/inventory-aging.dto.js';
import { AttentionResponseDto } from '../dto/shop/attention.dto.js';

@ApiTags('dashboard-shop')
@Controller('dashboard/shop')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class DashboardShopController {
  constructor(
    private readonly shopService: DashboardShopService,
    private readonly receivablesService: DashboardReceivablesService,
    private readonly productsService: DashboardProductsService,
    private readonly inventoryService: DashboardInventoryService,
  ) {}

  private checkOwner(req: OwnerRequest): void {
    if (req.user?.role !== UserRole.OWNER) {
      throw new ForbiddenException(
        'Only shop owners can access financial dashboard metrics',
      );
    }
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Shop flow and balance KPIs' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ShopKpisResponseDto, 'Shop KPIs'),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async getKpis(
    @Query() query: ShopDashboardQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ShopKpisResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.shopService.getKpis(req.user.shopId, query);
      return new ApiSuccessResponseDTO('Shop KPIs fetched successfully', data);
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getKpis', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch KPIs');
    }
  }

  @Get('sales-trend')
  @ApiOperation({ summary: 'Bucketed sales and profit trend' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(SalesTrendResponseDto, 'Sales trend'),
  )
  async getSalesTrend(
    @Query() query: ShopDashboardQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<SalesTrendResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.shopService.getSalesTrend(req.user.shopId, query);
      return new ApiSuccessResponseDTO(
        'Sales trend fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getSalesTrend', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch sales trend');
    }
  }

  @Get('profit-waterfall')
  @ApiOperation({ summary: 'Profit waterfall steps' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ProfitWaterfallResponseDto, 'Waterfall'),
  )
  async getProfitWaterfall(
    @Query() query: ShopDashboardQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ProfitWaterfallResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.shopService.getProfitWaterfall(
        req.user.shopId,
        query,
      );
      return new ApiSuccessResponseDTO(
        'Profit waterfall fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getProfitWaterfall', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch profit waterfall',
      );
    }
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Bucketed cash flow in, out and net change' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(CashFlowResponseDto, 'Cash flow'),
  )
  async getCashFlow(
    @Query() query: ShopDashboardQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<CashFlowResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.shopService.getCashFlow(req.user.shopId, query);
      return new ApiSuccessResponseDTO('Cash flow fetched successfully', data);
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getCashFlow', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch cash flow');
    }
  }

  @Get('receivables-aging')
  @ApiOperation({
    summary: 'Receivables aging breakdown by bracket and top debtors',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ReceivablesAgingResponseDto, 'Receivables aging'),
  )
  async getReceivablesAging(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ReceivablesAgingResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.receivablesService.getReceivablesAging(
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Receivables aging fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getReceivablesAging', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch receivables aging',
      );
    }
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top products by revenue, profit or units sold' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(TopProductsResponseDto, 'Top products'),
  )
  async getTopProducts(
    @Query() query: ShopDashboardQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<TopProductsResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.productsService.getTopProducts(
        req.user.shopId,
        query,
      );
      return new ApiSuccessResponseDTO(
        'Top products fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getTopProducts', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch top products');
    }
  }

  @Get('sales-mix')
  @ApiOperation({ summary: 'Sales mix by tracking type and category' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(SalesMixResponseDto, 'Sales mix'),
  )
  async getSalesMix(
    @Query() query: ShopDashboardQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<SalesMixResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.productsService.getSalesMix(
        req.user.shopId,
        query,
      );
      return new ApiSuccessResponseDTO('Sales mix fetched successfully', data);
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getSalesMix', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch sales mix');
    }
  }

  @Get('expenses-by-category')
  @ApiOperation({ summary: 'Expense distribution across categories' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(ExpensesByCategoryResponseDto, 'Expenses by category'),
  )
  async getExpensesByCategory(
    @Query() query: ShopDashboardQueryDto,
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<ExpensesByCategoryResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.inventoryService.getExpensesByCategory(
        req.user.shopId,
        query,
      );
      return new ApiSuccessResponseDTO(
        'Expenses by category fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getExpensesByCategory', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch expenses by category',
      );
    }
  }

  @Get('inventory-aging')
  @ApiOperation({ summary: 'Inventory age brackets and condition split' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(InventoryAgingResponseDto, 'Inventory aging'),
  )
  async getInventoryAging(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<InventoryAgingResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.inventoryService.getInventoryAging(
        req.user.shopId,
      );
      return new ApiSuccessResponseDTO(
        'Inventory aging fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getInventoryAging', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch inventory aging');
    }
  }

  @Get('attention')
  @ApiOperation({ summary: 'Actionable items requiring shop owner attention' })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(AttentionResponseDto, 'Attention items'),
  )
  async getAttention(
    @Req() req: OwnerRequest,
  ): Promise<ApiSuccessResponseDTO<AttentionResponseDto>> {
    try {
      this.checkOwner(req);
      const data = await this.inventoryService.getAttention(req.user.shopId);
      return new ApiSuccessResponseDTO(
        'Attention items fetched successfully',
        data,
      );
    } catch (error) {
      logError('dashboard-shop.controller.ts', 'getAttention', error, {
        shopId: req.user?.shopId,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch attention items');
    }
  }
}
