import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ManagedList } from './ManagedList';

describe('ManagedList', () => {
  it('shows the validateName problem and does not rename', async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    render(
      <ManagedList
        noun="inventory tag"
        entries={[{ id: 'home', name: 'home' }]}
        loadError={null}
        onRename={onRename}
        onDelete={vi.fn()}
        deleteWarning=""
        validateName={(name) => (name.includes(',') ? 'Tags cannot contain commas' : null)}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'New name for home' });
    await user.clear(input);
    await user.type(input, 'red, blue{Enter}');

    expect(screen.getByText('Tags cannot contain commas')).toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'house{Enter}');
    expect(onRename).toHaveBeenCalledWith('home', 'house');
  });
});
