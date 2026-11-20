import { BoxIcon, ReceiptIcon, WalletIcon } from '../../components/icons';

export type AnalyticsSectionSlug = 'inventory' | 'sales' | 'expenses';

export interface AnalyticsSection {
  slug: AnalyticsSectionSlug;
  to: string;
  /** Short, for the sidebar drop-down, which already sits under "Analytics". */
  label: string;
  /** The page's heading and tab title. */
  title: string;
  description: string;
  icon: typeof BoxIcon;
}

/** The deeper Analytics pages, in the order the sidebar drop-down and the Analytics page list them. */
export const ANALYTICS_SECTIONS: AnalyticsSection[] = [
  {
    slug: 'inventory',
    to: '/analytics/inventory',
    label: 'Inventory',
    title: 'Inventory Analytics',
    description: 'Stock value, low stock, and items not selling this month.',
    icon: BoxIcon,
  },
  {
    slug: 'sales',
    to: '/analytics/sales',
    label: 'Sales',
    title: 'Sales Analytics',
    description: "This month's sales count, average and largest sale, and best sellers.",
    icon: ReceiptIcon,
  },
  {
    slug: 'expenses',
    to: '/analytics/expenses',
    label: 'Expenses',
    title: 'Expense Analytics',
    description: "Where this month's money goes, and the biggest restock spending.",
    icon: WalletIcon,
  },
];
