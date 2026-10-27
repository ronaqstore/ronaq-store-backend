import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CashDirection,
  RecordStatus,
  TrackingType,
  UnitStatus,
} from '../../generated/prisma/enums.js';
import { businessDayRange, businessToday } from '../../helpers/date.helper.js';
import { DashboardQueryFilterDto } from '../dto/dashboard-query.filter.js';
import { DashboardDto } from '../dto/response-dashboard.dto.js';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(
    query: DashboardQueryFilterDto,
    shopId: string,
  ): Promise<DashboardDto> {
    const date = businessToday();
    const { start, end } = businessDayRange(date);

    const businessDate = new Date(`${date}T00:00:00.000Z`);

    const [
      todaySalesAgg,
      todaySaleItems,
      todayReturnsAgg,
      todayReturnItems,
      todayExpenseAgg,
      customerOpenings,
      shopSales,
      shopPayments,
      shopReturns,
      shopRefunds,
      supplierOpenings,
      shopPurchases,
      shopSupplierPayments,
      cashByDirection,
      quantityProducts,
      serializedProducts,
    ] = await Promise.all([
      this.prisma.sale.aggregate({
        where: {
          shopId,
          status: RecordStatus.ACTIVE,
          saleDate: { gte: start, lte: end },
        },
        _sum: { totalAmount: true },
      }),

      this.prisma.saleItem.findMany({
        where: {
          shopId,
          sale: {
            status: RecordStatus.ACTIVE,
            saleDate: { gte: start, lte: end },
          },
        },
        select: { unitCost: true, quantity: true },
      }),
      this.prisma.saleReturn.aggregate({
        where: {
          shopId,
          status: RecordStatus.ACTIVE,
          returnDate: { gte: start, lte: end },
        },
        _sum: { returnAmount: true },
      }),
      this.prisma.returnItem.findMany({
        where: {
          shopId,
          saleReturn: {
            status: RecordStatus.ACTIVE,
            returnDate: { gte: start, lte: end },
          },
        },
        select: {
          quantity: true,
          saleItem: { select: { unitCost: true } },
        },
      }),
      this.prisma.expense.aggregate({
        where: {
          shopId,
          status: RecordStatus.ACTIVE,
          expenseDate: { equals: businessDate },
        },
        _sum: { amount: true },
      }),
      this.prisma.customer.aggregate({
        where: { shopId },
        _sum: { openingBalance: true },
      }),
      this.prisma.sale.aggregate({
        where: { shopId, status: RecordStatus.ACTIVE },
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: { shopId, status: RecordStatus.ACTIVE },
        _sum: { amount: true },
      }),
      this.prisma.saleReturn.aggregate({
        where: { shopId, status: RecordStatus.ACTIVE },
        _sum: { returnAmount: true },
      }),

      this.prisma.refund.aggregate({
        where: { shopId, saleReturn: { status: RecordStatus.ACTIVE } },
        _sum: { amount: true },
      }),
      this.prisma.supplier.aggregate({
        where: { shopId },
        _sum: { openingBalance: true },
      }),
      this.prisma.purchase.aggregate({
        where: {
          shopId,
          status: RecordStatus.ACTIVE,
          isOpeningStock: false,
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.supplierPayment.aggregate({
        where: { shopId, status: RecordStatus.ACTIVE },
        _sum: { amount: true },
      }),
      this.prisma.cashMovement.groupBy({
        by: ['direction'],
        where: { shopId },
        _sum: { amount: true },
      }),
      this.prisma.product.findMany({
        where: {
          shopId,
          isActive: true,
          trackingType: TrackingType.QUANTITY,
        },
        select: {
          lowStockThreshold: true,
          stockLevel: { select: { quantityOnHand: true } },
        },
      }),
      this.prisma.product.findMany({
        where: {
          shopId,
          isActive: true,
          trackingType: TrackingType.SERIALIZED,
        },
        select: {
          lowStockThreshold: true,
          _count: {
            select: {
              inventoryUnits: { where: { status: UnitStatus.IN_STOCK } },
            },
          },
        },
      }),
    ]);

    const todayGrossSales = Number(todaySalesAgg._sum.totalAmount ?? 0n);
    const todayReturns = Number(todayReturnsAgg._sum.returnAmount ?? 0n);
    const todaySales = Math.max(0, todayGrossSales - todayReturns);

    const todayGrossCogs = todaySaleItems.reduce(
      (sum, item) => sum + Number(item.unitCost) * item.quantity,
      0,
    );
    const todayReturnedCogs = todayReturnItems.reduce(
      (sum, item) => sum + Number(item.saleItem.unitCost) * item.quantity,
      0,
    );
    const cogs = Math.max(0, todayGrossCogs - todayReturnedCogs);

    const todayExpenses = Number(todayExpenseAgg._sum.amount ?? 0n);
    const todayNetProfit = todaySales - cogs - todayExpenses;

    const customerUdhar =
      Number(customerOpenings._sum.openingBalance ?? 0n) +
      Number(shopSales._sum.totalAmount ?? 0n) -
      Number(shopPayments._sum.amount ?? 0n) -
      Number(shopReturns._sum.returnAmount ?? 0n) +
      Number(shopRefunds._sum.amount ?? 0n);

    const supplierPayable =
      Number(supplierOpenings._sum.openingBalance ?? 0n) +
      Number(shopPurchases._sum.totalAmount ?? 0n) -
      Number(shopSupplierPayments._sum.amount ?? 0n);

    const lowStockProducts =
      quantityProducts.filter(
        (p) => (p.stockLevel?.quantityOnHand ?? 0) <= p.lowStockThreshold,
      ).length +
      serializedProducts.filter(
        (p) => p._count.inventoryUnits <= p.lowStockThreshold,
      ).length;

    let cashIn = 0n;
    let cashOut = 0n;
    for (const row of cashByDirection) {
      const amount = row._sum.amount ?? 0n;
      if (row.direction === CashDirection.IN) cashIn += amount;
      else cashOut += amount;
    }

    const day = `from=${date}&to=${date}`;
    return {
      period: query.period ?? 'today',
      date,
      todaySales,
      todayNetProfit: todaySales - cogs - todayExpenses,
      customerUdhar,
      supplierPayable,
      todayExpenses,
      lowStockProducts,
      cashPosition: Number(cashIn - cashOut),
      links: {
        todaySales: `/sales?${day}`,
        todayNetProfit: `/sales?${day}`,
        customerUdhar: '/customers',
        supplierPayable: '/suppliers',
        todayExpenses: `/expenses?${day}`,
        lowStockProducts: '/products',
        cashPosition: '/cash/movements',
      },
    };
  }
}
