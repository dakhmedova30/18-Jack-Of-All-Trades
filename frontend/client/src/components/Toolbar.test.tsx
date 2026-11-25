import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  it('only shows bulk delete actions when rows are selected', () => {
    const toolbar = { onAdd: () => {}, onDelete: () => {}, selectedCount: 0 };
    const { rerender } = render(<Toolbar {...toolbar} />);

    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    rerender(
      <Toolbar onAdd={toolbar.onAdd} onDelete={toolbar.onDelete} selectedCount={2} />,
    );

    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('toggles the filter panel and reports its expanded state', () => {
    render(
      <Toolbar
        search={<input aria-label="Search" />}
        onAdd={() => {}}
        transfer={<span>CSV actions</span>}
        selectedCount={0}
        filters={<div>Channel filters</div>}
        activeFilterCount={2}
      />,
    );

    const filters = screen.getByRole('button', { name: 'Filters, 2 active' });
    const panelId = filters.getAttribute('aria-controls');
    const panel = document.getElementById(panelId ?? '');

    expect(filters).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel).toHaveAttribute('inert');

    fireEvent.click(filters);

    expect(filters).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveAttribute('aria-hidden', 'false');
    expect(panel).not.toHaveAttribute('inert');

    fireEvent.click(filters);
    expect(filters).toHaveAttribute('aria-expanded', 'false');
  });
});
