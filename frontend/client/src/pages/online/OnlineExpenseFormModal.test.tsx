import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as authApi from '../../api/auth';
import { PageProviders } from '../../test/providers';
import { OnlineExpenseFormModal } from './OnlineExpenseFormModal';

vi.mock('../../api/auth', () => ({ getCurrentBusiness: vi.fn() }));

describe('OnlineExpenseFormModal', () => {
  it('collects online expense description and category', async () => {
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <OnlineExpenseFormModal
        defaultDate="2026-10-01"
        knownTags={[]}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
      { wrapper: PageProviders },
    );
    await user.type(screen.getByLabelText('Description'), 'Listing fee');
    await user.type(screen.getByLabelText('Category'), 'Platform');
    await user.type(screen.getByLabelText(/^Amount/), '5.50');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Listing fee',
        category: 'Platform',
        amountCents: 550,
      }),
    );
  });

  it('names the commission expense dialog correctly', () => {
    vi.mocked(authApi.getCurrentBusiness).mockResolvedValue(undefined);
    render(
      <OnlineExpenseFormModal
        context="commission"
        defaultDate="2026-10-01"
        knownTags={[]}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
      { wrapper: PageProviders },
    );
    expect(screen.getByRole('dialog', { name: 'Add commission expense' })).toBeInTheDocument();
  });
});
