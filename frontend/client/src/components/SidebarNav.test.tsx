import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SidebarNav } from './SidebarNav';

function renderAt(path: string, compact = false) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarNav compact={compact} />
    </MemoryRouter>,
  );
}

describe('SidebarNav', () => {
  it('keeps Analytics a link and opens its sub-pages from the arrow', async () => {
    const user = userEvent.setup();
    renderAt('/');

    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/analytics');
    expect(screen.queryByRole('link', { name: 'Sales Analytics' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand Analytics' }));

    expect(screen.getByRole('button', { name: 'Collapse Analytics' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Inventory Analytics' })).toHaveAttribute(
      'href',
      '/analytics/inventory',
    );
    expect(screen.getByRole('link', { name: 'Sales Analytics' })).toHaveAttribute(
      'href',
      '/analytics/sales',
    );
    expect(screen.getByRole('link', { name: 'Expense Analytics' })).toHaveAttribute(
      'href',
      '/analytics/expenses',
    );
  });

  it('opens on a sub-page with that page marked current', () => {
    renderAt('/analytics/sales');

    expect(screen.getByRole('link', { name: 'Sales Analytics' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Only the sub-page is current, not Analytics itself or the main Sales page.
    expect(screen.getByRole('link', { name: 'Analytics' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Sales' })).not.toHaveAttribute('aria-current');
  });

  it('shows no drop-downs in the collapsed rail', () => {
    renderAt('/analytics/sales', true);

    expect(screen.getByRole('link', { name: 'Analytics' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Analytics/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sales Analytics' })).not.toBeInTheDocument();
  });
});
