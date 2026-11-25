import { ANALYTICS_SECTIONS } from '../pages/analytics/analyticsSections';
import { BoxIcon, ChartIcon, HomeIcon, ReceiptIcon, TagIcon, WalletIcon } from './icons';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  end: boolean;
  /**
   * Shown in a drop-down under the item. `ariaLabel` names a link whose short label repeats a
   * main item's, e.g. "Inventory Analytics" for "Inventory" under Analytics.
   */
  children?: { to: string; label: string; ariaLabel?: string }[];
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/inventory', label: 'Inventory', icon: BoxIcon, end: false },
  {
    to: '/sales',
    label: 'Sales',
    icon: ReceiptIcon,
    // Like Analytics: stays highlighted on its sub-pages.
    end: false,
    children: [
      { to: '/sales/in-person', label: 'In-Person Markets' },
      { to: '/sales/online', label: 'Online Shop' },
      { to: '/sales/commissions', label: 'Commissions' },
      { to: '/sales/misc', label: 'Miscellaneous' },
    ],
  },
  { to: '/expenses', label: 'Expenses', icon: WalletIcon, end: false },
  { to: '/discounts', label: 'Discounts & Charges', icon: TagIcon, end: false },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: ChartIcon,
    // Stays highlighted on its sub-pages, which matters most in the collapsed sidebar.
    end: false,
    children: ANALYTICS_SECTIONS.map(({ to, label, title }) => ({ to, label, ariaLabel: title })),
  },
];
