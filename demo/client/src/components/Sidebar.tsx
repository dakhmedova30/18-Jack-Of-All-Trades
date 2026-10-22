import { NavLink } from 'react-router-dom';
import { BoxIcon, ChartIcon, HomeIcon, LogOutIcon, ReceiptIcon, WalletIcon } from './icons';

const NAV_ITEMS = [
{ to: '/', label: 'Home', icon: HomeIcon, end: true },
{ to: '/inventory', label: 'Inventory', icon: BoxIcon, end: false },
{ to: '/sales', label: 'Sales', icon: ReceiptIcon, end: false },
{ to: '/expenses', label: 'Expenses', icon: WalletIcon, end: false },
{ to: '/analytics', label: 'Analytics', icon: ChartIcon, end: false },
];

type SidebarProps = {
onClose: () => void;
};

export function Sidebar({ onClose }: SidebarProps) {
    return (
        <aside className="sidebar" id="main-sidebar">
            <div className="sidebar__header">
                <div className="sidebar__logo">Jack-Of-All-Trades</div>
                <button
                    type="button"
                    className="sidebar__toggle"
                    onClick={onClose}
                    aria-label="Hide sidebar"
                >
                    ‹
                </button>
            </div>
            <nav className="sidebar__nav" aria-label="Main">
                {NAV_ITEMS.map(({ to, label, icon: NavIcon, end }) => (
                    <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
                    >
                    <NavIcon />
                    {label}
                    </NavLink>
                ))}
            </nav>

            {/* Placeholder until auth lands: looks like the real thing, does nothing yet. */}
            <button type="button" className="sidebar__link sidebar__logout">
                <LogOutIcon />
                Log Out
            </button>
        </aside>
    );
}