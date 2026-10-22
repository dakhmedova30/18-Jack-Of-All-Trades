import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/http';
import * as authApi from '../../api/auth';
import { AuthProvider } from '../../hooks/useAuth';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

const business = {
  id: 1,
  name: 'Test Business',
  email: 'owner@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderAuthPage(page: 'login' | 'register') {
  const Page = page === 'login' ? LoginPage : RegisterPage;
  const path = page === 'login' ? '/login' : '/register';

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={path} element={<Page />} />
          <Route path="/" element={<p>Signed-in destination</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('authentication pages', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
  });

  it('shows a login error when the credentials are rejected', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockRejectedValue(new Error('Invalid email or password'));
    renderAuthPage('login');

    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'wrong-password',
    });
  });

  it('logs in and navigates to the signed-in destination', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValue(business);
    renderAuthPage('login');

    await user.type(screen.getByLabelText('Email'), business.email);
    await user.type(screen.getByLabelText('Password'), 'secure-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('Signed-in destination')).toBeInTheDocument());
    expect(authApi.login).toHaveBeenCalledWith({
      email: business.email,
      password: 'secure-password',
    });
  });

  it('shows field validation errors returned during registration', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiError(400, 'Registration failed', [
        { field: 'email', message: 'Enter a valid email address' },
      ]),
    );
    renderAuthPage('register');

    await user.type(screen.getByLabelText('Business name'), 'Test Business');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Registration failed')).toBeInTheDocument();
  });

  it('registers the business and navigates to the signed-in destination', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockResolvedValue(business);
    renderAuthPage('register');

    await user.type(screen.getByLabelText('Business name'), business.name);
    await user.type(screen.getByLabelText('Email'), business.email);
    await user.type(screen.getByLabelText('Password'), 'secure-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(screen.getByText('Signed-in destination')).toBeInTheDocument());
    expect(authApi.register).toHaveBeenCalledWith({
      name: business.name,
      email: business.email,
      password: 'secure-password',
    });
  });
});
