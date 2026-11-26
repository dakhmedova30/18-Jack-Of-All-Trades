import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DiscountFormModal } from './DiscountFormModal';

vi.mock('../../api/discounts', () => ({
  listDiscountAppliesTo: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => 'CAD',
}));

describe('DiscountFormModal', () => {
  it('marks required fields for each discount kind', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <DiscountFormModal onCancel={() => {}} onSubmit={async () => {}} />,
    );

    expect(screen.getByLabelText(/^Name/)).toBeRequired();
    expect(screen.getByLabelText(/^Percentage/)).toBeRequired();
    expect(container.querySelectorAll('.required-marker')).toHaveLength(2);

    const kind = screen.getByLabelText('Kind');
    await user.selectOptions(kind, 'PRESET');

    expect(screen.getByLabelText(/^Buy/)).toBeRequired();
    expect(screen.getByLabelText(/^Get/)).toBeRequired();
    expect(screen.getByLabelText(/^Percentage/)).toBeRequired();
    expect(container.querySelectorAll('.required-marker')).toHaveLength(4);

    await user.selectOptions(kind, 'PER_AMOUNT');

    expect(screen.getByLabelText('Break 1 count')).toBeRequired();
    expect(screen.getByLabelText('Break 1 price (CAD)')).toBeRequired();
    expect(container.querySelectorAll('.required-marker')).toHaveLength(4);
  });
});
