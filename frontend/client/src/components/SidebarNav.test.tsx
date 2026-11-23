import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SidebarNav } from './SidebarNav';

/** The sidebar at `path`, beside a stand-in for the Sales Analytics card on the Analytics page. */
function renderAt(path: string, compact = false) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarNav compact={compact} />
      <Link to="/analytics/sales">Sales Analytics card</Link>
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

  it('marks Analytics as the current page on Analytics itself', () => {
    renderAt('/analytics');

    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
  });

  it('on a sub-page, opens the drop-down and keeps Analytics highlighted', () => {
    renderAt('/analytics/sales');

    expect(screen.getByRole('link', { name: 'Sales Analytics' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Analytics marks the section the page is in; the main Sales page isn't current.
    const analytics = screen.getByRole('link', { name: 'Analytics' });
    expect(analytics).toHaveClass('is-active');
    expect(analytics).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Sales' })).not.toHaveAttribute('aria-current');
  });

  it('opens the drop-down when a card on Analytics leads to a sub-page', async () => {
    const user = userEvent.setup();
    renderAt('/analytics');
    expect(screen.queryByRole('link', { name: 'Sales Analytics' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Sales Analytics card' }));

    expect(screen.getByRole('button', { name: 'Collapse Analytics' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Sales Analytics' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveClass('is-active');
  });

  it('keeps Analytics highlighted in the collapsed rail, which has no drop-downs', async () => {
    const user = userEvent.setup();
    renderAt('/analytics', true);

    await user.click(screen.getByRole('link', { name: 'Sales Analytics card' }));

    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveClass('is-active');
    expect(screen.queryByRole('button', { name: /Analytics/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sales Analytics' })).not.toBeInTheDocument();
  });
});
