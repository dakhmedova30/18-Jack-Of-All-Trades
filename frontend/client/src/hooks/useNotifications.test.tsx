import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/http';
import { listNotifications } from '../api/notifications';
import type { AppNotification } from '../types';
import { NotificationsProvider, POLL_MS, useNotifications } from './useNotifications';

vi.mock('../api/notifications', () => ({ listNotifications: vi.fn() }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ business: { id: 1 } }) }));

function alert(title: string): AppNotification {
  return {
    type: 'low-stock',
    fingerprint: title,
    title,
    message: title,
    link: '/inventory',
    userAgent: null,
    at: null,
  };
}

function Titles() {
  const { alerts } = useNotifications();
  return <p>{alerts.map((a) => a.title).join(', ') || 'none'}</p>;
}

function renderProvider() {
  return render(
    <NotificationsProvider>
      <Titles />
    </NotificationsProvider>,
  );
}

let hidden = false;
function setHidden(value: boolean) {
  hidden = value;
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Lets resolved promises (the fetch and its .then) run. */
async function flush() {
  await act(async () => {});
}

describe('NotificationsProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    vi.mocked(listNotifications).mockResolvedValue([]);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.mocked(listNotifications).mockReset();
    vi.unstubAllGlobals();
  });

  it('refetches right after a save, without waiting for the next poll', async () => {
    renderProvider();
    await flush();
    expect(listNotifications).toHaveBeenCalledTimes(1);

    vi.mocked(listNotifications).mockResolvedValue([alert('Paper is low')]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await act(() => apiRequest('/sales', { method: 'POST', json: {} }));
    await flush();

    expect(listNotifications).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Paper is low')).toBeInTheDocument();
  });

  it('does not refetch after a plain read', async () => {
    renderProvider();
    await flush();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
    await act(() => apiRequest('/sales'));
    await flush();

    expect(listNotifications).toHaveBeenCalledTimes(1);
  });

  it('polls every 30 seconds while visible, stops while hidden, and catches up when shown', async () => {
    renderProvider();
    await flush();
    expect(listNotifications).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    expect(listNotifications).toHaveBeenCalledTimes(2);

    setHidden(true);
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 5));
    expect(listNotifications).toHaveBeenCalledTimes(2);

    setHidden(false);
    await flush();
    expect(listNotifications).toHaveBeenCalledTimes(3);
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    expect(listNotifications).toHaveBeenCalledTimes(4);
  });

  it('keeps the newest alerts when an older request answers last', async () => {
    let answerFirst: (alerts: AppNotification[]) => void = () => {};
    vi.mocked(listNotifications)
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce([alert('Newer')]);
    renderProvider();

    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    expect(screen.getByText('Newer')).toBeInTheDocument();

    await act(async () => answerFirst([alert('Older')]));
    expect(screen.getByText('Newer')).toBeInTheDocument();
  });

  it('stops polling and listening once unmounted', async () => {
    const { unmount } = renderProvider();
    await flush();
    unmount();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await apiRequest('/sales', { method: 'POST', json: {} });
    await vi.advanceTimersByTimeAsync(POLL_MS * 2);

    expect(listNotifications).toHaveBeenCalledTimes(1);
  });
});
