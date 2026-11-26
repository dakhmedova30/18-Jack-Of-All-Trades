import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listItemTags } from '../../api/items';
import { TagFilter } from './TagFilter';

vi.mock('../../api/items', () => ({ listItemTags: vi.fn() }));

/** The filter with its own state, as the Inventory page holds it. */
function Harness({ initial = [] }: { initial?: string[] }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <TagFilter value={tags} onChange={setTags} />
      <p>Outside</p>
    </>
  );
}

describe('TagFilter', () => {
  beforeEach(() => {
    vi.mocked(listItemTags).mockReset();
    vi.mocked(listItemTags).mockResolvedValue([
      { name: 'stickers', itemCount: 4 },
      { name: 'prints', itemCount: 2 },
    ]);
  });

  it('lists the tags with their item counts and sums up what is ticked', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const button = screen.getByRole('button', { name: 'Tags All tags' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    const stickers = await screen.findByRole('checkbox', { name: 'stickers (4 items)' });
    await user.click(stickers);
    expect(screen.getByRole('button', { name: 'Tags stickers' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'prints (2 items)' }));
    expect(screen.getByRole('button', { name: 'Tags 2 tags' })).toBeInTheDocument();

    await user.click(stickers);
    expect(screen.getByRole('button', { name: 'Tags prints' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: 'Tags All tags' })).toBeInTheDocument();
  });

  it('keeps a ticked tag that is no longer in use, so it can be unticked', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['retired']} />);

    await user.click(screen.getByRole('button', { name: 'Tags retired' }));
    const retired = await screen.findByRole('checkbox', { name: 'retired (0 items)' });
    expect(retired).toBeChecked();
    await user.click(retired);
    expect(screen.getByRole('button', { name: 'Tags All tags' })).toBeInTheDocument();
  });

  it('closes on Escape (back to the button) and on a click outside', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Tags All tags' });

    await user.click(button);
    await screen.findByRole('checkbox', { name: /^stickers/ });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Filter items by tag' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByText('Outside'));
    expect(screen.queryByRole('group', { name: 'Filter items by tag' })).not.toBeInTheDocument();
  });

  it('says when there are no tags yet, and shows a loading error', async () => {
    const user = userEvent.setup();
    vi.mocked(listItemTags).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Offline'));
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Tags All tags' });

    await user.click(button);
    expect(await screen.findByText(/No tags yet/)).toBeInTheDocument();
    await user.click(button);
    await user.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  });
});
