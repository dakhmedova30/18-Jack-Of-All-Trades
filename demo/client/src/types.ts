// Mirrors the API response shapes in server/src/modules/*.

export interface Item {
  id: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  tags: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type ItemInput = Pick<Item, 'name' | 'quantity' | 'unitPriceCents' | 'tags' | 'note'>;

export type ItemSortField = 'id' | 'name' | 'quantity' | 'unitPriceCents';
export type SaleSortField = 'id' | 'soldAt' | 'total' | 'tags';
export type ExpenseSortField = 'id' | 'incurredAt' | 'total' | 'tags';
export type SortOrder = 'asc' | 'desc';

export interface ExpenseMonthBreakdown {
  /** The calendar month covered: [start, end). */
  periodStart: string;
  periodEnd: string;
  /** Lines linked to an inventory item. */
  restockCents: number;
  /** Free-text lines: rent, fees, supplies and so on. */
  runningCents: number;
  totalCents: number;
  /** Top items by restock spending this month, most first (up to 5). */
  topRestockItems: { id: number; name: string; units: number; spentCents: number }[];
}

export interface SalesMonthSummary {
  /** The calendar month covered: [start, end). */
  periodStart: string;
  periodEnd: string;
  saleCount: number;
  revenueCents: number;
  /** Revenue / number of sales; 0 with no sales. */
  averageSaleCents: number;
  largestSale: { id: number; soldAt: string; totalCents: number } | null;
}

export interface InventoryInsights {
  /** Quantity x unit (selling) price, summed over every item. */
  stockValueCents: number;
  totalUnits: number;
  /** The calendar month the best sellers cover: [start, end). */
  periodStart: string;
  periodEnd: string;
  /** Top 3 items by units sold this month, most first. */
  bestSellers: { id: number; name: string; unitsSold: number; revenueCents: number }[];
}

export interface LowStock {
  /** Every item at or below `threshold`, not just the ones listed in `items`. */
  count: number;
  threshold: number;
  /** Up to the requested limit (5 by default) of those items, lowest quantity first. */
  items: Pick<Item, 'id' | 'name' | 'quantity'>[];
}

export interface SaleItem {
  id: number;
  itemId: number | null;
  itemName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Sale {
  id: number;
  soldAt: string;
  tags: string[];
  totalCents: number;
  items: SaleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SaleLineItemInput {
  itemId: number;
  quantity: number;
}

export interface SaleInput {
  soldAt: string;
  tags: string[];
  items: SaleLineItemInput[];
}

export interface ExpenseItem {
  id: number;
  itemId: number | null;
  itemName: string;
  quantity: number;
  unitCostCents: number;
  totalCents: number;
}

export interface Expense {
  id: number;
  incurredAt: string;
  tags: string[];
  totalCents: number;
  items: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseLineItemInput {
  /** Set to restock an inventory item; leave null and give `description` for a free-text cost. */
  itemId: number | null;
  description: string;
  quantity: number;
  unitCostCents: number;
}

export interface ExpenseInput {
  incurredAt: string;
  tags: string[];
  items: ExpenseLineItemInput[];
}

export interface AnalyticsTagSeries {
  label: string;
  values: number[];
}

export type AnalyticsRange = 'week' | 'month' | 'ytd' | '12months';

/** Current stock by first tag. A snapshot, so the "Show by" range doesn't apply. */
export interface InventoryByTag {
  /** Largest first; tags past the top 7 fold into "Other" (last). */
  byTag: { label: string; quantity: number; itemCount: number }[];
  totalQuantity: number;
  totalItems: number;
}

export interface AnalyticsSummary {
  /** Sum of revenueSeries / expenseSeries — i.e. scoped to `range`, not all-time. */
  totalRevenueCents: number;
  totalExpensesCents: number;
  netProfitCents: number;
  /** The page-wide "Show by" filter: every chart and total above moves with it. */
  range: AnalyticsRange;
  granularity: 'day' | 'month';
  buckets: string[];
  bucketLabels: string[];
  revenueSeries: AnalyticsTagSeries[];
  expenseSeries: AnalyticsTagSeries[];
  salesByTag: { label: string; valueCents: number }[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
