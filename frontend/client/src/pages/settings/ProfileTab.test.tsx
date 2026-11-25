import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { testBusiness } from '../../test/fixtures';
import { PageProviders } from '../../test/providers';
import { ProfileTab } from './ProfileTab';

vi.mock('../../api/auth', () => ({
  getCurrentBusiness: vi.fn(),
  updateBusiness: vi.fn(),
}));

/** The public profile form links to /p/<slug>, so the tab needs a router. */
function Providers({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PageProviders>{children}</PageProviders>
    </MemoryRouter>
  );
}

const business = { ...testBusiness, phone: '416-555-0100', publicSlug: 'rings' };

describe('ProfileTab contact details', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(business);
  });

  it('saves the public email and the choice to show the phone', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.updateBusiness).mockResolvedValue({
      ...business,
      publicEmail: 'hello@rings.example',
      showPhonePublicly: true,
    });
    render(<ProfileTab />, { wrapper: Providers });

    const showPhone = await screen.findByRole('checkbox', {
      name: 'Show my phone on my public profile',
    });
    expect(showPhone).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    await user.click(showPhone);
    await user.type(screen.getByLabelText('Public email'), '  hello@rings.example ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(authApi.updateBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ publicEmail: 'hello@rings.example', showPhonePublicly: true }),
    );
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Show my phone on my public profile' }),
    ).toBeChecked();
  });

  it('enables saving when only the phone checkbox changes', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue({
      ...business,
      showPhonePublicly: true,
    });
    render(<ProfileTab />, { wrapper: Providers });

    const showPhone = await screen.findByRole('checkbox', {
      name: 'Show my phone on my public profile',
    });
    expect(showPhone).toBeChecked();
    await user.click(showPhone);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
