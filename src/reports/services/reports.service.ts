import { Injectable } from '@nestjs/common';
import type { ReportQueryFilterDto } from '../dto/report-query.filter.js';
import type { ReportPageResponseDTO } from '../dto/report-page-response.dto.js';
import type {
  SaleReportRowDTO,
  SalesReportSummaryDTO,
} from '../dto/sales-report.dto.js';
import type {
  PurchaseReportRowDTO,
  PurchaseReportSummaryDTO,
} from '../dto/purchase-report.dto.js';
import type {
  ExpenseReportRowDTO,
  ExpenseReportSummaryDTO,
} from '../dto/expense-report.dto.js';
import type {
  ProfitReportSummaryDTO,
  ProfitDayRowDTO,
} from '../dto/profit-report.dto.js';
import type {
  CustomerReportRowDTO,
  CustomerReportSummaryDTO,
} from '../dto/customer-report.dto.js';
import type {
  SupplierReportRowDTO,
  SupplierReportSummaryDTO,
} from '../dto/supplier-report.dto.js';
import type {
  InventoryReportRowDTO,
  InventoryReportSummaryDTO,
} from '../dto/inventory-report.dto.js';
import type {
  BestSellerReportRowDTO,
  BestSellerReportSummaryDTO,
} from '../dto/best-seller-report.dto.js';
import { ReportsLedgerService } from './reports-ledger.service.js';
import { ReportsAnalyticsService } from './reports-analytics.service.js';

@Injectable()
export class ReportsService {
  constructor(
    private readonly ledger: ReportsLedgerService,
    private readonly analytics: ReportsAnalyticsService,
  ) {}

  getSalesReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<ReportPageResponseDTO<SaleReportRowDTO, SalesReportSummaryDTO>> {
    return this.ledger.getSalesReport(query, shopId);
  }

  getPurchaseReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<PurchaseReportRowDTO, PurchaseReportSummaryDTO>
  > {
    return this.ledger.getPurchaseReport(query, shopId);
  }

  getExpenseReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<ExpenseReportRowDTO, ExpenseReportSummaryDTO>
  > {
    return this.ledger.getExpenseReport(query, shopId);
  }

  getProfitReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<ReportPageResponseDTO<ProfitDayRowDTO, ProfitReportSummaryDTO>> {
    return this.ledger.getProfitReport(query, shopId);
  }

  getCustomerReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<CustomerReportRowDTO, CustomerReportSummaryDTO>
  > {
    return this.analytics.getCustomerReport(query, shopId);
  }

  getSupplierReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<SupplierReportRowDTO, SupplierReportSummaryDTO>
  > {
    return this.analytics.getSupplierReport(query, shopId);
  }

  getInventoryReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<InventoryReportRowDTO, InventoryReportSummaryDTO>
  > {
    return this.analytics.getInventoryReport(query, shopId);
  }

  getBestSellersReport(
    query: ReportQueryFilterDto,
    shopId: string,
  ): Promise<
    ReportPageResponseDTO<BestSellerReportRowDTO, BestSellerReportSummaryDTO>
  > {
    return this.analytics.getBestSellersReport(query, shopId);
  }
}
