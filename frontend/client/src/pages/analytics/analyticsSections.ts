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
    description: "Stock value and levels, what's running out, and what isn't selling.",
    icon: BoxIcon,
  },
  {
    slug: 'sales',
    to: '/analytics/sales',
    label: 'Sales',
    title: 'Sales Analytics',
    description: 'This month and best sellers, plus trends, busiest days and channels over time.',
    icon: ReceiptIcon,
  },
  {
    slug: 'expenses',
    to: '/analytics/expenses',
    label: 'Expenses',
    title: 'Expense Analytics',
    description: "Where this month's money goes, plus profit and costs over time.",
    icon: WalletIcon,
  },
];
