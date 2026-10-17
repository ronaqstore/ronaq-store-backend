import {
  ApiExtraModels,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
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
  OK_RESPONSE_STATUS,
  UNAUTHORIZED_REQUEST_RESPONSE,
  AuthGuard,
  ApiSuccessResponseDTO,
  logError,
  exportReportOrJson,
  ReportsService,
  ReportQueryFilterDto,
  ReportPageResponseDTO,
} from './reports-controller.imports.js';
import type { Response, OwnerRequest } from './reports-controller.imports.js';
import {
  CustomerReportRowDTO,
  CustomerReportSummaryDTO,
  customerReportCsvColumns,
  customerReportSummaryCsv,
} from '../dto/customer-report.dto.js';
import {
  SupplierReportRowDTO,
  SupplierReportSummaryDTO,
  supplierReportCsvColumns,
  supplierReportSummaryCsv,
} from '../dto/supplier-report.dto.js';
import {
  InventoryReportRowDTO,
  InventoryReportSummaryDTO,
  inventoryReportCsvColumns,
  inventoryReportSummaryCsv,
} from '../dto/inventory-report.dto.js';
import {
  BestSellerReportRowDTO,
  BestSellerReportSummaryDTO,
  bestSellerReportCsvColumns,
  bestSellerReportSummaryCsv,
} from '../dto/best-seller-report.dto.js';

@ApiTags('reports')
@Controller('reports')
@ApiBearerAuth()
@ApiExtraModels(
  CustomerReportRowDTO,
  CustomerReportSummaryDTO,
  SupplierReportRowDTO,
  SupplierReportSummaryDTO,
  InventoryReportRowDTO,
  InventoryReportSummaryDTO,
  BestSellerReportRowDTO,
  BestSellerReportSummaryDTO,
)
@UseGuards(AuthGuard)
export class ReportsSnapshotController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('customers')
  @ApiOperation({
    summary: 'Customer report (who owes how much)',
    description:
      'WF18 — a snapshot of every customer’s Udhar right now: bought, paid, returns, refunds, outstanding ' +
      '(opening + bought − paid − returns + refunds) and overdue (past dueDate parts of ACTIVE sales). ' +
      'The date range is ignored — outstanding is a cumulative fact, not a period sum.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ReportPageResponseDTO,
      'Customer report fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async customerReport(
    @Query() query: ReportQueryFilterDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | ApiSuccessResponseDTO<
        ReportPageResponseDTO<CustomerReportRowDTO, CustomerReportSummaryDTO>
      >
    | string
  > {
    try {
      const report = await this.reportsService.getCustomerReport(
        query,
        req.user.shopId,
      );
      return exportReportOrJson(
        res,
        query,
        report,
        'customers',
        customerReportCsvColumns,
        customerReportSummaryCsv,
        'Customer report fetched successfully',
      );
    } catch (error) {
      logError('reports-snapshot.controller.ts', 'customerReport', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build customer report');
    }
  }

  @Get('suppliers')
  @ApiOperation({
    summary: 'Supplier report (payable per supplier)',
    description:
      'WF18 — a snapshot of how much the shop owes each supplier: opening balance + bought (real, ' +
      'non-opening-stock purchases) − paid. The date range is ignored — payable is a cumulative fact.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ReportPageResponseDTO,
      'Supplier report fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async supplierReport(
    @Query() query: ReportQueryFilterDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | ApiSuccessResponseDTO<
        ReportPageResponseDTO<SupplierReportRowDTO, SupplierReportSummaryDTO>
      >
    | string
  > {
    try {
      const report = await this.reportsService.getSupplierReport(
        query,
        req.user.shopId,
      );
      return exportReportOrJson(
        res,
        query,
        report,
        'suppliers',
        supplierReportCsvColumns,
        supplierReportSummaryCsv,
        'Supplier report fetched successfully',
      );
    } catch (error) {
      logError('reports-snapshot.controller.ts', 'supplierReport', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build supplier report');
    }
  }

  @Get('inventory')
  @ApiOperation({
    summary: 'Inventory report (stock now)',
    description:
      'WF18 — a snapshot of every ACTIVE product: quantity on hand (accessories) or IN_STOCK units ' +
      '(phones, with their IMEIs), stock value and low-stock flag. The date range is ignored — stock is a point-in-time fact.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ReportPageResponseDTO,
      'Inventory report fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async inventoryReport(
    @Query() query: ReportQueryFilterDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | ApiSuccessResponseDTO<
        ReportPageResponseDTO<InventoryReportRowDTO, InventoryReportSummaryDTO>
      >
    | string
  > {
    try {
      const report = await this.reportsService.getInventoryReport(
        query,
        req.user.shopId,
      );
      return exportReportOrJson(
        res,
        query,
        report,
        'inventory',
        inventoryReportCsvColumns,
        inventoryReportSummaryCsv,
        'Inventory report fetched successfully',
      );
    } catch (error) {
      logError('reports-snapshot.controller.ts', 'inventoryReport', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to build inventory report',
      );
    }
  }

  @Get('best-sellers')
  @ApiOperation({
    summary: 'Best-selling products report',
    description:
      'WF18 — Σ quantity per product over the period’s ACTIVE sales, most sold first: what customers ' +
      'actually buy. Revenue = Σ line totals. Adds the same discount-free line totals the sales report uses.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ReportPageResponseDTO,
      'Best-sellers report fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async bestSellersReport(
    @Query() query: ReportQueryFilterDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | ApiSuccessResponseDTO<
        ReportPageResponseDTO<
          BestSellerReportRowDTO,
          BestSellerReportSummaryDTO
        >
      >
    | string
  > {
    try {
      const report = await this.reportsService.getBestSellersReport(
        query,
        req.user.shopId,
      );
      return exportReportOrJson(
        res,
        query,
        report,
        'best-sellers',
        bestSellerReportCsvColumns,
        bestSellerReportSummaryCsv,
        'Best-sellers report fetched successfully',
      );
    } catch (error) {
      logError('reports-snapshot.controller.ts', 'bestSellersReport', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Failed to build best-sellers report',
      );
    }
  }
}
