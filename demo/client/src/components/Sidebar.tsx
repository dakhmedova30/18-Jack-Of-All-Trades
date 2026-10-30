import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AccountMenu } from './AccountMenu';
import { NotificationBell } from './NotificationBell';
import { BoxIcon, ChartIcon, HomeIcon, ReceiptIcon, WalletIcon } from './icons';

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
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="sidebar" id="main-sidebar">
      <div className="sidebar__header">
        {/* The logo goes home, the same as the Home link below. */}
        <Link to="/" className="sidebar__logo">
          Jack-Of-All-Trades
        </Link>
        <div className="sidebar__header-actions">
          <NotificationBell />
          <button
            type="button"
            className="sidebar__toggle"
            onClick={onClose}
            aria-label="Hide sidebar"
          >
            ‹
          </button>
        </div>
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

      <div className="sidebar__account">
        {/* Shows the profile picture, or the business's initials (e.g. DB) if there isn't one. */}
        {business && (
          <AccountMenu
            name={business.name}
            email={business.email}
            imageUrl={business.avatarUrl}
            onLogout={handleLogout}
          />
        )}
      </div>
    </aside>
  );
}
