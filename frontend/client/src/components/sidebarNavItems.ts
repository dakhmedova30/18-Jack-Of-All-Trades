import { ANALYTICS_SECTIONS } from '../pages/analytics/analyticsSections';
import { BoxIcon, ChartIcon, HomeIcon, ReceiptIcon, WalletIcon } from './icons';

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
  { to: '/sales', label: 'Sales', icon: ReceiptIcon, end: false },
  { to: '/expenses', label: 'Expenses', icon: WalletIcon, end: false },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: ChartIcon,
    end: true,
    children: ANALYTICS_SECTIONS.map(({ to, label, title }) => ({ to, label, ariaLabel: title })),
  },
];
