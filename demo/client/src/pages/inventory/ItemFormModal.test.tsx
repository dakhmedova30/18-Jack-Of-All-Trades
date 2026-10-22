import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ItemInput } from '../../types';
import { ItemFormModal } from './ItemFormModal';

describe('ItemFormModal', () => {
  it('shows validation errors and does not submit invalid input', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(_input: ItemInput) => Promise<void>>();
    render(<ItemFormModal onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number, 0 or more')).toBeInTheDocument();
    expect(screen.getByText('Enter a price like 5 or 5.99')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed item details, cents, and distinct tags', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(_input: ItemInput) => Promise<void>>().mockResolvedValue();
    render(<ItemFormModal onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Name'), '  Tea  ');
    await user.type(screen.getByLabelText('Qty'), '12');
    await user.type(screen.getByLabelText('Unit price (CAD)'), '4.5');
    await user.type(screen.getByLabelText('Tags'), ' Drinks, Tea, Drinks ');
    await user.type(screen.getByLabelText('Note'), '  Loose leaf  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Tea',
      quantity: 12,
      unitPriceCents: 450,
      tags: ['Drinks', 'Tea'],
      note: 'Loose leaf',
    });
  });
});
