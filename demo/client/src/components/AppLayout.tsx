import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { NotificationsProvider } from '../hooks/useNotifications';
import { PreferencesProvider } from '../hooks/usePreferences';
import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { MenuIcon } from './icons';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <PreferencesProvider>
      <NotificationsProvider>
        <div className={`app${sidebarOpen ? '' : ' app--sidebar-hidden'}`}>
          {sidebarOpen ? (
            <Sidebar onClose={() => setSidebarOpen(false)} />
          ) : (
            <div className="sidebar-show-container">
              <div className="sidebar__header-actions">
                <button
                  type="button"
                  className="sidebar__toggle"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Show sidebar"
                  aria-controls="main-sidebar"
                  aria-expanded={false}
                >
                  <MenuIcon />
                </button>
                <NotificationBell />
              </div>
              
            </div>
          )}
          <main className="content">
            <Outlet />
          </main>
        </div>
      </NotificationsProvider>
    </PreferencesProvider>
  );
}
