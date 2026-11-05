import { BoxIcon, ChartIcon, HomeIcon, ReceiptIcon, WalletIcon } from './icons';

export const SIDEBAR_NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/inventory', label: 'Inventory', icon: BoxIcon, end: false },
  { to: '/sales', label: 'Sales', icon: ReceiptIcon, end: false },
  { to: '/expenses', label: 'Expenses', icon: WalletIcon, end: false },
  { to: '/analytics', label: 'Analytics', icon: ChartIcon, end: false },
];
