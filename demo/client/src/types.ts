// Mirrors the API response shapes in server/src/modules/*.

export interface Business {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

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
export type SaleSortField = 'id' | 'soldAt' | 'total' | 'tags' | 'channel';
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

export interface Channel {
  id: number;
  name: string;
}

/** One choice in the expense form's Tag dropdown. Expenses store the name in `tags`. */
export interface ExpenseTag {
  id: number;
  name: string;
}

export interface Sale {
  id: number;
  soldAt: string;
  /** null only for sales recorded before channels existed. */
  channel: Channel | null;
  description: string;
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
  channelId: number;
  /** Leave blank and the server writes "Item x qty, ..." from the lines. */
  description: string;
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
  description: string;
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
  /** Leave blank and the server writes "Item x qty, ..." from the lines. */
  description: string;
  tags: string[];
  items: ExpenseLineItemInput[];
}

export interface AnalyticsTagSeries {
  label: string;
  values: number[];
}

export type AnalyticsRange = 'week' | 'month' | 'ytd' | '12months';

/** A period of whole UTC days, both ends included, as "YYYY-MM-DD". */
export interface DateRange {
  from: string;
  to: string;
}

/** The two ends of the Analytics date filter: the first and last day with a sale or expense. */
export interface AnalyticsDateRange {
  /** Both null when there are no sales or expenses yet. */
  firstDate: string | null;
  lastDate: string | null;
  /** The server's UTC date. */
  today: string;
}

/** Current stock by first tag. A snapshot, so the date filter doesn't apply. */
export interface InventoryByTag {
  /** Largest first; tags past the top 7 fold into "Other" (last). */
  byTag: { label: string; quantity: number; itemCount: number }[];
  totalQuantity: number;
  totalItems: number;
}

export interface AnalyticsSummary {
  /** Sum of revenueSeries / expenseSeries — i.e. scoped to the range or period, not all-time. */
  totalRevenueCents: number;
  totalExpensesCents: number;
  netProfitCents: number;
  /** The "Show by" range asked for, or "custom" for a chosen period. */
  range: AnalyticsRange | 'custom';
  granularity: 'day' | 'week' | 'month';
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
