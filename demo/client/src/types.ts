// Mirrors the API response shapes in server/src/modules/*.

export interface Business {
  id: number;
  name: string;
  email: string;
  /** Optional details, null until the owner sets them. */
  businessType: string | null;
  country: string | null;
  /** IANA time zone, e.g. "America/Toronto". */
  timeZone: string;
  /** 3-letter code, e.g. "CAD". */
  currency: string;
  /** Items with this many or fewer in stock count as low stock. */
  lowStockThreshold: number;
  lastLoginAt: string | null;
  /** URL of the profile picture (with a version for cache busting), or null if there isn't one. */
  avatarUrl: string | null;
  /** Owner, contact, description and links: all optional, null until set. */
  ownerFirstName: string | null;
  ownerLastName: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  description: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  etsy: string | null;
  /** URL of the business logo (with a version for cache busting), or null. */
  logoUrl: string | null;
  createdAt: string;
}

/** One browser or device that is logged in. `userAgent` is null for older sessions. */
export interface SessionInfo {
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
}

/** One past login. */
export interface LoginEvent {
  at: string;
  userAgent: string | null;
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

/** One alert that applies right now (GET /api/notifications). */
export interface AppNotification {
  type: 'low-stock' | 'out-of-stock' | 'no-sales' | 'expense-spike' | 'new-device';
  /** Changes when the alert's situation does; a dismissed alert stays hidden until then. */
  fingerprint: string;
  title: string;
  message: string;
  /** Where "View" goes, e.g. "/inventory". */
  link: string;
  /** Only set for new-device alerts. */
  userAgent: string | null;
  at: string | null;
}

/** Which alerts the business wants and the numbers that set them off. */
export interface NotificationSettings {
  lowStock: boolean;
  outOfStock: boolean;
  newDevice: boolean;
  noSales: boolean;
  noSalesDays: number;
  expenseSpike: boolean;
  expenseSpikePercent: number;
}

/** A tag in use on the business's items, and how many items carry it. */
export interface ItemTagCount {
  name: string;
  itemCount: number;
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
