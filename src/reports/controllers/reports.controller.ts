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
  SaleReportRowDTO,
  SalesReportSummaryDTO,
  salesReportCsvColumns,
  salesReportSummaryCsv,
} from '../dto/sales-report.dto.js';
import {
  PurchaseReportRowDTO,
  PurchaseReportSummaryDTO,
  purchaseReportCsvColumns,
  purchaseReportSummaryCsv,
} from '../dto/purchase-report.dto.js';
import {
  ExpenseReportRowDTO,
  ExpenseReportSummaryDTO,
  expenseReportCsvColumns,
  expenseReportSummaryCsv,
} from '../dto/expense-report.dto.js';
import {
  ProfitReportSummaryDTO,
  ProfitDayRowDTO,
  profitDayCsvColumns,
  profitReportSummaryCsv,
} from '../dto/profit-report.dto.js';

@ApiTags('reports')
@Controller('reports')
@ApiBearerAuth()
@ApiExtraModels(
  SaleReportRowDTO,
  SalesReportSummaryDTO,
  PurchaseReportRowDTO,
  PurchaseReportSummaryDTO,
  ExpenseReportRowDTO,
  ExpenseReportSummaryDTO,
  ProfitDayRowDTO,
  ProfitReportSummaryDTO,
)
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({
    summary: 'Sales report',
    description:
      'WF18 — per-sale totals, discount and profit over today / this week / this month / a custom range ' +
      '(Asia/Karachi business days). CANCELLED sales are excluded. `format=csv` downloads the same rows as ' +
      'a CSV instead of JSON. profit = subtotal − Σ(unitCost × qty) on that sale.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ReportPageResponseDTO,
      'Sales report fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async salesReport(
    @Query() query: ReportQueryFilterDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | ApiSuccessResponseDTO<
        ReportPageResponseDTO<SaleReportRowDTO, SalesReportSummaryDTO>
      >
    | string
  > {
    try {
      const report = await this.reportsService.getSalesReport(
        query,
        req.user.shopId,
      );
      return exportReportOrJson(
        res,
        query,
        report,
        'sales',
        salesReportCsvColumns,
        salesReportSummaryCsv,
        'Sales report fetched successfully',
      );
    } catch (error) {
      logError('reports.controller.ts', 'salesReport', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build sales report');
    }
  }

  @Get('purchases')
  @ApiOperation({
    summary: 'Purchase report',
    description:
      'WF18 — what was bought in the period, how much has been paid and what is still due per bill. ' +
      'Opening-stock bills are shown but create no payable. CANCELLED purchases are excluded.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ReportPageResponseDTO,
      'Purchase report fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async purchaseReport(
    @Query() query: ReportQueryFilterDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | ApiSuccessResponseDTO<
        ReportPageResponseDTO<PurchaseReportRowDTO, PurchaseReportSummaryDTO>
      >
    | string
  > {
    try {
      const report = await this.reportsService.getPurchaseReport(
        query,
        req.user.shopId,
      );
      return exportReportOrJson(
        res,
        query,
        report,
        'purchases',
        purchaseReportCsvColumns,
        purchaseReportSummaryCsv,
        'Purchase report fetched successfully',
      );
    } catch (error) {
      logError('reports.controller.ts', 'purchaseReport', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build purchase report');
    }
  }

  @Get('expenses')
  @ApiOperation({
    summary: 'Expense report',
    description:
      'WF18 — every ACTIVE expense in the period with totals by category (rent, electricity, salary…). ' +
      'Buying stock is a purchase, never an expense. `format=csv` includes a category-breakdown block.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ReportPageResponseDTO,
      'Expense report fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async expenseReport(
    @Query() query: ReportQueryFilterDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | ApiSuccessResponseDTO<
        ReportPageResponseDTO<ExpenseReportRowDTO, ExpenseReportSummaryDTO>
      >
    | string
  > {
    try {
      const report = await this.reportsService.getExpenseReport(
        query,
        req.user.shopId,
      );
      return exportReportOrJson(
        res,
        query,
        report,
        'expenses',
        expenseReportCsvColumns,
        expenseReportSummaryCsv,
        'Expense report fetched successfully',
      );
    } catch (error) {
      logError('reports.controller.ts', 'expenseReport', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build expense report');
    }
  }

  @Get('profit')
  @ApiOperation({
    summary: 'Profit report',
    description:
      'WF18 — gross and net profit for the period. net = sales − Σ(unitCost × qty) − returns (goods given ' +
      'back in the period) − expenses. Refunds are the cash side of a return and are NOT subtracted again — ' +
      'revenue and cash are never mixed (WF18 rule). Returns daily rows for the chart.',
  })
  @ApiSuccessResponseDecorator(
    OK_RESPONSE_STATUS(
      ReportPageResponseDTO,
      'Profit report fetched successfully',
    ),
  )
  @ApiResponse(BAD_REQUEST_RESPONSE)
  @ApiResponse(UNAUTHORIZED_REQUEST_RESPONSE)
  @ApiResponse(INTERNAL_SERVER_ERROR_RESPONSE)
  async profitReport(
    @Query() query: ReportQueryFilterDto,
    @Req() req: OwnerRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<
    | ApiSuccessResponseDTO<
        ReportPageResponseDTO<ProfitDayRowDTO, ProfitReportSummaryDTO>
      >
    | string
  > {
    try {
      const report = await this.reportsService.getProfitReport(
        query,
        req.user.shopId,
      );
      return exportReportOrJson(
        res,
        query,
        report,
        'profit',
        profitDayCsvColumns,
        profitReportSummaryCsv,
        'Profit report fetched successfully',
      );
    } catch (error) {
      logError('reports.controller.ts', 'profitReport', error, {
        shopId: req.user?.shopId,
        query,
      });
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to build profit report');
    }
  }
}
