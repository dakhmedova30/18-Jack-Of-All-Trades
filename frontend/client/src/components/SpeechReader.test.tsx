import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentBusiness } from '../api/auth';
import { PageProviders } from '../test/providers';
import type { Business } from '../types';
import { SpeechReader } from './SpeechReader';

// The reader reads the show/hide preference; with no business, preferences are the defaults.
vi.mock('../api/auth', () => ({ getCurrentBusiness: vi.fn() }));

class MockUtterance {
  text: string;
  rate = 1;
  lang = '';
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

describe('SpeechReader section navigation', () => {
  const spoken: MockUtterance[] = [];
  const synthesis = {
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    speak: vi.fn((utterance: MockUtterance) => {
      spoken.push(utterance);
    }),
  };

  beforeEach(() => {
    spoken.length = 0;
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getCurrentBusiness).mockResolvedValue(undefined);
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: synthesis,
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  function renderReader() {
    render(
      <MemoryRouter>
        <PageProviders>
          <main>
            <h1>First section</h1>
            <p>Second section</p>
            <h2>Third section</h2>
            <p>Fourth section</p>
          </main>
          <SpeechReader />
        </PageProviders>
      </MemoryRouter>,
    );
  }

  it('shows on pages outside the preferences provider', () => {
    render(
      <MemoryRouter>
        <main>
          <h1>Logged-out page</h1>
        </main>
        <SpeechReader />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Read page aloud' })).toBeInTheDocument();
  });

  it('respects the saved hide preference for a logged-in business', async () => {
    localStorage.setItem('jat:preferences:42', JSON.stringify({ showSpeechReader: false }));
    vi.mocked(getCurrentBusiness).mockResolvedValue({ id: 42 } as Business);

    renderReader();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Read page aloud' })).not.toBeInTheDocument();
    });
  });

  it('skips forward and backward between page sections', async () => {
    const user = userEvent.setup();
    renderReader();

    await user.click(screen.getByRole('button', { name: 'Read page aloud' }));

    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe('First section');
    expect(screen.getByRole('button', { name: 'Previous section' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next section' }));
    expect(spoken).toHaveLength(2);
    expect(spoken[1].text).toBe('Second section');
    expect(screen.getByRole('button', { name: 'Previous section' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Previous section' }));
    expect(spoken).toHaveLength(3);
    expect(spoken[2].text).toBe('First section');
  });

  it('disables section navigation at the page boundaries', async () => {
    const user = userEvent.setup();
    renderReader();

    await user.click(screen.getByRole('button', { name: 'Read page aloud' }));

    const next = screen.getByRole('button', { name: 'Next section' });
    await user.click(next);
    await user.click(next);
    await user.click(next);

    expect(screen.getByRole('button', { name: 'Next section' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous section' })).toBeEnabled();
  });

  it('stops reading and removes section navigation', async () => {
    const user = userEvent.setup();
    renderReader();

    await user.click(screen.getByRole('button', { name: 'Read page aloud' }));
    await user.click(screen.getByRole('button', { name: 'Stop reading' }));

    expect(synthesis.cancel).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Previous section' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next section' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Reading stopped.');
  });
});
