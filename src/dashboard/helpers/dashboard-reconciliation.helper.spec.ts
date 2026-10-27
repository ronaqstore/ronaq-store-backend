import { assertFunnelMonotonicFromCounts } from './dashboard-platform.helper.js';
import {
  assertShopScoped,
  cashClosingMatchesDrawer,
  inventoryAgingCountMatches,
  isOwnerRole,
  sumTrendSales,
  udharAgingMatchesTotal,
  waterfallNetProfit,
} from './dashboard-reconciliation.helper.js';

describe('dashboard reconciliation helpers', () => {
  it('waterfall net profit equals KPI net profit formula', () => {
    const net = waterfallNetProfit({
      grossSales: 1_000_000,
      costOfGoods: 600_000,
      returns: 50_000,
      expenses: 150_000,
    });
    expect(net).toBe(200_000);
  });

  it('sales-trend series sum equals KPI sales', () => {
    const series = [{ sales: 100 }, { sales: 250 }, { sales: 50 }];
    expect(sumTrendSales(series)).toBe(400);
  });

  it('cash-flow last closing equals cash drawer balance', () => {
    expect(cashClosingMatchesDrawer(12_500_00, 12_500_00)).toBe(true);
    expect(cashClosingMatchesDrawer(1, 2)).toBe(false);
  });

  it('udhar aging total equals customers receivable total', () => {
    expect(udharAgingMatchesTotal(9_999, 9_999)).toBe(true);
    expect(udharAgingMatchesTotal(1, 0)).toBe(false);
  });

  it('inventory aging count equals IN_STOCK units', () => {
    expect(inventoryAgingCountMatches(42, 42)).toBe(true);
    expect(inventoryAgingCountMatches(41, 42)).toBe(false);
  });

  it('funnel stages are monotonic', () => {
    expect(assertFunnelMonotonicFromCounts([100, 80, 70, 50, 40, 25])).toBe(
      true,
    );
    expect(assertFunnelMonotonicFromCounts([100, 101])).toBe(false);
  });

  it('multi-tenant isolation: service shopId must match JWT shopId', () => {
    expect(assertShopScoped('shop-a', 'shop-a')).toBe(true);
    expect(assertShopScoped('shop-a', 'shop-b')).toBe(false);
  });

  it('non-owner role is rejected for profit/cost endpoints', () => {
    expect(isOwnerRole('OWNER')).toBe(true);
    expect(isOwnerRole('MANAGER')).toBe(false);
    expect(isOwnerRole('CASHIER')).toBe(false);
  });
});
