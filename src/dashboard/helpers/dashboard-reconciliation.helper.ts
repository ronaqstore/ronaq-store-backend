export interface WaterfallInputs {
  grossSales: number;
  costOfGoods: number;
  returns: number;
  expenses: number;
}

export function waterfallNetProfit(input: WaterfallInputs): number {
  return input.grossSales - input.costOfGoods - input.returns - input.expenses;
}

export function sumTrendSales(series: Array<{ sales: number }>): number {
  return series.reduce((sum, row) => sum + row.sales, 0);
}

export function cashClosingMatchesDrawer(
  lastBucketClosing: number,
  cashDrawerBalance: number,
): boolean {
  return lastBucketClosing === cashDrawerBalance;
}

export function udharAgingMatchesTotal(
  agingTotal: number,
  customersReceivableTotal: number,
): boolean {
  return agingTotal === customersReceivableTotal;
}

export function inventoryAgingCountMatches(
  agingCount: number,
  inStockUnitCount: number,
): boolean {
  return agingCount === inStockUnitCount;
}

export function assertShopScoped(
  calledShopId: string,
  jwtShopId: string,
): boolean {
  return calledShopId === jwtShopId && calledShopId.length > 0;
}

export function isOwnerRole(role: string): boolean {
  return role === 'OWNER';
}
