import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from './api/auth';
import * as notificationsApi from './api/notifications';
import { App } from './App';
import { Sidebar } from './components/Sidebar';
import { AuthProvider } from './hooks/useAuth';
import { NotificationsProvider } from './hooks/useNotifications';
import { testBusiness } from './test/fixtures';

vi.mock('./api/auth', () => ({
  getCurrentBusiness: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

// The sidebar's notification bell loads alerts.
vi.mock('./api/notifications', () => ({
  listNotifications: vi.fn(),
}));

describe('protected routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
  });

  it('redirects anonymous visitors from inventory to login', async () => {
    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});

describe('logout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(testBusiness);
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue([]);
    vi.mocked(authApi.logout).mockResolvedValue();
  });

  it('logs out and navigates to login', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <NotificationsProvider>
                  <Sidebar onClose={vi.fn()} />
                  <p>Signed-in destination</p>
                </NotificationsProvider>
              }
            />
            <Route path="/login" element={<p>Login destination</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    // Log out is in the account menu, opened from the business's pill in the sidebar.
    await user.click(await screen.findByRole('button', { name: 'Account menu for Test Business' }));
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalledOnce();
  });
});
