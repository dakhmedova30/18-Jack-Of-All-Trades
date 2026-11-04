import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { NotificationsProvider } from '../hooks/useNotifications';
import { PreferencesProvider } from '../hooks/usePreferences';
import { ClosedSidebar } from './ClosedSidebar';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <PreferencesProvider>
      <NotificationsProvider>
        <div className={`app${sidebarOpen ? '' : ' app--sidebar-hidden'}`}>
          <div className={`sidebar-rail${sidebarOpen ? '' : ' sidebar-rail--closed'}`}>
            <div
              className={`sidebar-view sidebar-view--open${sidebarOpen ? '' : ' sidebar-view--inactive'}`}
              aria-hidden={!sidebarOpen}
              inert={!sidebarOpen}
            >
              <Sidebar onClose={() => setSidebarOpen(false)} active={sidebarOpen} />
            </div>
            <div
              className={`sidebar-view sidebar-view--closed${sidebarOpen ? ' sidebar-view--inactive' : ''}`}
              aria-hidden={sidebarOpen}
              inert={sidebarOpen}
            >
              <ClosedSidebar onOpen={() => setSidebarOpen(true)} active={!sidebarOpen} />
            </div>
          </div>
          <main className="content">
            <Outlet />
          </main>
        </div>
      </NotificationsProvider>
    </PreferencesProvider>
  );
}
