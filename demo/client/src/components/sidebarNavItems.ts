import { BoxIcon, ChartIcon, HomeIcon, ReceiptIcon, TagIcon, WalletIcon } from './icons';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  end: boolean;
  /** Shown in a drop-down under the item. */
  children?: { to: string; label: string }[];
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/inventory', label: 'Inventory', icon: BoxIcon, end: false },
  {
    to: '/sales',
    label: 'Sales',
    icon: ReceiptIcon,
    end: true,
    children: [
      { to: '/sales/in-person', label: 'In-Person Market' },
      { to: '/sales/online', label: 'Online Shop' },
      { to: '/sales/commissions', label: 'Commissions' },
      { to: '/sales/misc', label: 'Miscellaneous' },
    ],
  },
  { to: '/expenses', label: 'Expenses', icon: WalletIcon, end: false },
  { to: '/discounts', label: 'Discounts & Charges', icon: TagIcon, end: false },
  { to: '/analytics', label: 'Analytics', icon: ChartIcon, end: false },
];
