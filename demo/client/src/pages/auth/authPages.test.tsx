import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/http';
import * as authApi from '../../api/auth';
import { AuthProvider } from '../../hooks/useAuth';
import { testBusiness } from '../../test/fixtures';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

const business = testBusiness;

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
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    renderAuthPage('login');

    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(
      await screen.findByText(
        'Login failed. The email or password is incorrect. Check them and try again.',
      ),
    ).toBeInTheDocument();
    expect(authApi.login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'wrong-password',
    });
  });

  it('checks the login fields before sending, and links each error to its field', async () => {
    const user = userEvent.setup();
    renderAuthPage('login');

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    // Each error is read as its field's description, not as part of the field's name.
    expect(screen.getByLabelText('Email')).toHaveAccessibleName('Email');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password');
    expect(
      screen.getByText('Login failed. Fix the highlighted fields and try again.'),
    ).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
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

  it('checks the registration fields before sending', async () => {
    const user = userEvent.setup();
    renderAuthPage('register');

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByLabelText('Business name')).toHaveAccessibleName('Business name');
    expect(screen.getByLabelText('Business name')).toHaveAccessibleDescription(
      'Enter your business name',
    );
    expect(screen.getByLabelText('Email')).toHaveAccessibleName('Email');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email');
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(
      screen.getByText('Account creation failed. Fix the highlighted fields and try again.'),
    ).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('shows field errors the server returns during registration', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiError(400, 'Validation failed', [
        { field: 'name', message: 'Name must be at most 120 characters' },
      ]),
    );
    renderAuthPage('register');

    await user.type(screen.getByLabelText('Business name'), 'Test Business');
    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Name must be at most 120 characters')).toBeInTheDocument();
    expect(
      screen.getByText('Account creation failed. Fix the highlighted fields and try again.'),
    ).toBeInTheDocument();
  });

  it('suggests logging in when the email is already registered', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiError(400, 'An account with that email already exists'),
    );
    renderAuthPage('register');

    await user.type(screen.getByLabelText('Business name'), 'Test Business');
    await user.type(screen.getByLabelText('Email'), 'owner@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('This email is already registered')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Account creation failed. An account with this email already exists. Log in instead, or use a different email.',
      ),
    ).toBeInTheDocument();
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
