import { AccountMenu } from './AccountMenu';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { MenuIcon } from './icons';
import { SidebarNav } from './SidebarNav';

type ClosedSidebarProps = {
  onOpen: () => void;
  active?: boolean;
};

export function ClosedSidebar({ onOpen, active = true }: ClosedSidebarProps) {
  const { business, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="sidebar-show-container">
      <div className="sidebar__header-actions">
        <button
          type="button"
          className="sidebar__toggle"
          onClick={onOpen}
          aria-label="Show sidebar"
          aria-controls="main-sidebar"
          aria-expanded={false}
        >
          <MenuIcon />
        </button>
        <NotificationBell key={active ? 'active' : 'inactive'} />
      </div>
      <SidebarNav compact />
      {business && (
        <div className="sidebar__account">
          <AccountMenu
            name={business.name}
            imageUrl={business.avatarUrl}
            compact
            key={active ? 'active' : 'inactive'}
            onLogout={handleLogout}
          />
        </div>
      )}
    </div>
  );
}
