import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { NotificationsProvider } from '../hooks/useNotifications';
import { PreferencesProvider } from '../hooks/usePreferences';
import { Sidebar } from './Sidebar';

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
              <button
                type="button"
                className="sidebar-show"
                onClick={() => setSidebarOpen(true)}
                aria-label="Show sidebar"
                aria-controls="main-sidebar"
                aria-expanded={false}
              >
                ☰
              </button>
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
