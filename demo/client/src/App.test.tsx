import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from './api/auth';
import { App } from './App';
import { Sidebar } from './components/Sidebar';
import { AuthProvider } from './hooks/useAuth';

vi.mock('./api/auth', () => ({
  getCurrentBusiness: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
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
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue({
      id: 1,
      name: 'Test Business',
      email: 'owner@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
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
                <>
                  <Sidebar onClose={vi.fn()} />
                  <p>Signed-in destination</p>
                </>
              }
            />
            <Route path="/login" element={<p>Login destination</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Test Business')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log Out' }));

    expect(await screen.findByText('Login destination')).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalledOnce();
  });
});
