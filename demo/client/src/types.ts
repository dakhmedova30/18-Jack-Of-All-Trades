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
  /** The public profile's link name (/p/<slug>), or null while the profile is off. */
  publicSlug: string | null;
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
  currency: string;
  originalPrice: number;
  originalCurrency: string;
  tags: string[];
  note: string;
  /** Shown on the business's public profile. */
  isPublic: boolean;
  /** Optional size; width, height and unit are all set or all null. */
  width: number | null;
  height: number | null;
  sizeUnit: SizeUnit | null;
  amountSold: number;
  /** Inactive items stay in history but can't be sold. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CURRENCY_CODES = ['CAD', 'USD', 'EUR', 'GBP', 'AUD'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const SIZE_UNITS = ['in', 'cm', 'mm', 'ft'] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

export interface ItemInput
  extends Pick<Item, 'name' | 'quantity' | 'unitPriceCents' | 'tags' | 'note' | 'isPublic'> {
  currency: CurrencyCode;
  width: number | null;
  height: number | null;
  sizeUnit: SizeUnit | null;
  amountSold: number;
  isActive: boolean;
}

/** PATCH body: the input fields, plus `clearSize` to remove a size. */
export type ItemUpdateInput = Partial<ItemInput> & { clearSize?: boolean };

/** An item as customers see it: no stock count, note or tags. */
export interface PublicItem {
  id: number;
  name: string;
  unitPriceCents: number;
  inStock: boolean;
}

/** GET /api/public/businesses/:slug, readable without logging in. */
export interface PublicProfile {
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  region: string | null;
  currency: string;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  etsy: string | null;
  logoUrl: string | null;
  items: PublicItem[];
}

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
  /** In-stock items with no sales this calendar month. */
  notSelling: { id: number; name: string; quantity: number }[];
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
  kind: 'ITEM' | 'DISCOUNT' | 'CHARGE' | 'TIP';
  isFree: boolean;
  isTrade: boolean;
  discountId: number | null;
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

export const DISCOUNT_KINDS = ['PRESET', 'PER_AMOUNT', 'SOLID'] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];
export type DiscountValueType = 'AMOUNT' | 'PERCENT';

export interface DiscountTier {
  count: number;
  priceCents: number;
}

/** A reusable discount or charge. Money values are in `currency`; percentages are 0–100. */
export interface Discount {
  id: number;
  name: string;
  /** An item tag; null means every item. */
  appliesTo: string | null;
  kind: DiscountKind;
  isCharge: boolean;
  valueType: DiscountValueType | null;
  value: number | null;
  buyCount: number | null;
  getCount: number | null;
  tiers: DiscountTier[];
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountInput {
  name: string;
  appliesTo: string | null;
  kind: DiscountKind;
  isCharge: boolean;
  valueType: DiscountValueType | null;
  value: number | null;
  buyCount: number | null;
  getCount: number | null;
  tiers: DiscountTier[];
  currency: CurrencyCode;
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
  currency: string;
  originalAmount: number;
  originalCurrency: string;
  items: SaleItem[];
  marketId: number | null;
  commissionId: number | null;
  miscId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleLineItemInput {
  itemId: number | null;
  quantity: number;
  /** Required when no inventory item is selected. */
  itemName?: string;
  /** Overrides the item's price. */
  unitPriceCents?: number | null;
  isFree?: boolean;
  isTrade?: boolean;
}

export interface SaleInput {
  soldAt: string;
  channelId: number;
  /** Leave blank and the server writes "Item x qty, ..." from the lines. */
  description: string;
  tags: string[];
  items: SaleLineItemInput[];
  marketId?: number | null;
  commissionId?: number | null;
  miscId?: number | null;
  currency?: CurrencyCode;
  tipCents?: number | null;
  /** Discounts and charges from the library, applied by the server. */
  discountIds?: number[];
}

export interface ExpenseItem {
  id: number;
  itemId: number | null;
  itemName: string;
  quantity: number;
  unitCostCents: number;
  totalCents: number;
  category: string;
  subcategory: string;
  manufacturer: string;
  type: ExpenseLineType;
}

export const EXPENSE_LINE_TYPES = ['product', 'shipping', 'fee', 'other'] as const;
export type ExpenseLineType = (typeof EXPENSE_LINE_TYPES)[number];

export interface Expense {
  id: number;
  incurredAt: string;
  description: string;
  tags: string[];
  totalCents: number;
  currency: string;
  originalAmount: number;
  originalCurrency: string;
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
  category: string;
  subcategory: string;
  manufacturer: string;
  type: ExpenseLineType;
}

export interface ExpenseInput {
  incurredAt: string;
  currency: CurrencyCode;
  /** Leave blank and the server writes "Item x qty, ..." from the lines. */
  description: string;
  tags: string[];
  items: ExpenseLineItemInput[];
}

export interface ExpenseLineReport {
  lineId: number;
  expenseId: number;
  incurredAt: string;
  expenseDescription: string;
  currency: CurrencyCode;
  originalCurrency: CurrencyCode;
  itemName: string;
  quantity: number;
  unitCostCents: number;
  totalCents: number;
  displayTotalCents: number;
  category: string;
  subcategory: string;
  manufacturer: string;
  type: ExpenseLineType;
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
  /** Every channel with revenue in the range or period, largest first. */
  revenueByChannel: { label: string; valueCents: number }[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const MARKET_STATUSES = ['PENDING', 'ACCEPTED', 'WAITLISTED', 'REJECTED'] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];
export const MARKET_GOING = ['PENDING', 'YES', 'NO'] as const;
export type MarketGoing = (typeof MARKET_GOING)[number];

export interface Market {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  tableFeeCents: number;
  extraExpensesCents: number;
  currency: CurrencyCode;
  website: string | null;
  status: MarketStatus;
  going: MarketGoing;
  tags: string[];
  /** Computed, in the market's currency. */
  expensesCents: number;
  revenueCents: number;
  tipsCents: number;
  salesCount: number;
  profitCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketInput {
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  tableFeeCents: number;
  extraExpensesCents: number;
  currency: CurrencyCode;
  website: string | null;
  status: MarketStatus;
  going: MarketGoing;
  tags: string[];
}

/** One month of the online shop; `month` is `YYYY-MM` and amounts are in `currency`. */
export interface OnlineMonth {
  month: string;
  salesCount: number;
  expensesCents: number;
  revenueCents: number;
  profitCents: number;
  currency: CurrencyCode;
}

export interface OnlineExpense {
  id: number;
  spentOn: string;
  description: string;
  category: string;
  amountCents: number;
  currency: CurrencyCode;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OnlineExpenseInput {
  spentOn: string;
  description: string;
  category: string;
  amountCents: number;
  currency: CurrencyCode;
  tags: string[];
}

export interface Commission {
  id: number;
  name: string;
  contact: string;
  request: string;
  receivedOn: string;
  deadline: string;
  tags: string[];
  salesCount: number;
  expensesCents: number;
  revenueCents: number;
  tipsCents: number;
  profitCents: number;
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionInput {
  name: string;
  contact: string;
  request: string;
  receivedOn: string;
  deadline: string;
  tags: string[];
}

export interface CommissionExpense extends OnlineExpense {
  commissionId: number | null;
}

export interface MiscellaneousRecord {
  id: number;
  name: string;
  receivedOn: string;
  tags: string[];
  salesCount: number;
  expensesCents: number;
  revenueCents: number;
  profitCents: number;
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface MiscellaneousInput {
  name: string;
  receivedOn: string;
  tags: string[];
}

export interface MiscExpense extends OnlineExpense {
  miscId: number | null;
}