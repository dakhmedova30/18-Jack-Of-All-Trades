import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarketFormModal } from './MarketFormModal';

vi.mock('../../hooks/useCurrency', () => ({ useCurrency: () => 'CAD' }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MarketFormModal location search', () => {
  it('clears and cancels an active search when the location is shortened', async () => {
    const fetchMock = vi.fn((_url: URL, _options: RequestInit) => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    render(<MarketFormModal knownTags={[]} onCancel={vi.fn()} onSubmit={vi.fn()} />);

    const input = screen.getByLabelText('Location');
    fireEvent.change(input, { target: { value: 'Paris' } });
    await screen.findByText('Searching…', {}, { timeout: 3000 });
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;

    fireEvent.change(input, { target: { value: 'Pa' } });
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText('Searching…')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('clears suggestions when a place is selected', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ properties: { name: 'Paris', country: 'France' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MarketFormModal knownTags={[]} onCancel={vi.fn()} onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Paris' } });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Paris, France' }, { timeout: 3000 }),
    );
    expect(screen.getByLabelText('Location')).toHaveValue('Paris, France');
    expect(screen.queryByRole('list', { name: 'Address suggestions' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Searching…')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
