import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ItemInput } from '../../types';
import { ItemFormModal } from './ItemFormModal';

// Required fields' labels end in a "*" that screen readers skip, and the price label also has
// a range hint, so fields are found by their accessible name rather than the label's full text.
const nameField = () => screen.getByRole('textbox', { name: 'Name' });
const qtyField = () => screen.getByRole('textbox', { name: 'Qty' });
const priceField = () => screen.getByRole('textbox', { name: /^Unit price \(CAD\)/ });

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

  it('rejects a negative price with the allowed range', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(_input: ItemInput) => Promise<void>>();
    render(<ItemFormModal onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.type(nameField(), 'Tea');
    await user.type(qtyField(), '1');
    await user.type(priceField(), '-2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText(/^Price must be between 0\.00 and/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed item details, cents, and distinct tags', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(_input: ItemInput) => Promise<void>>().mockResolvedValue();
    render(<ItemFormModal onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.type(nameField(), '  Tea  ');
    await user.type(qtyField(), '12');
    await user.type(priceField(), '4.5');
    await user.type(screen.getByLabelText('Tags'), ' Drinks, Tea, Drinks ');
    await user.type(screen.getByLabelText('Note'), '  Loose leaf  ');
    await user.click(screen.getByRole('checkbox', { name: /Show on my public profile/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Tea',
      quantity: 12,
      unitPriceCents: 450,
      tags: ['Drinks', 'Tea'],
      note: 'Loose leaf',
      isPublic: true,
    });
  });
});
