import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AccountMenu } from './AccountMenu';
import { NotificationBell } from './NotificationBell';
import { MenuIcon } from './icons';
import { SIDEBAR_NAV_ITEMS } from './sidebarNavItems';

type SidebarProps = {
  onClose: () => void;
  active?: boolean;
};

export function Sidebar({ onClose, active = true }: SidebarProps) {
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="sidebar" id="main-sidebar">
      <div className="sidebar__header">
        <div className="sidebar__header-actions">
          <button
            type="button"
            className="sidebar__toggle"
            onClick={onClose}
            aria-label="Hide sidebar"
            aria-expanded={true}
          >
            <MenuIcon />
          </button>
        </div>
        <div className="sidebar__header-actions">
          <NotificationBell key={active ? 'active' : 'inactive'} />
        </div>
      </div>
      <nav className="sidebar__nav" aria-label="Main">
        {SIDEBAR_NAV_ITEMS.map(({ to, label, icon: NavIcon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
          >
            <NavIcon />
            <span className="sidebar__link-label">{label}</span>
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
            key={active ? 'active' : 'inactive'}
            onLogout={handleLogout}
          />
        )}
      </div>
    </aside>
  );
}
