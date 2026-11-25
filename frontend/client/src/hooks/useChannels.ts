import { useCallback, useEffect, useState } from 'react';
import { listChannels } from '../api/channels';
import { getErrorMessage } from '../api/http';
import type { Channel } from '../types';

/** Loads the business's sales channels once, for filters. Call `reload()` to refetch. */
export function useChannels() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    data?: Channel[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listChannels()
      .then((data) => {
        if (!cancelled) setResult({ token: reloadToken, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ token: reloadToken, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    data: result?.data,
    error: result?.error,
    loading: result?.token !== reloadToken,
    reload,
  };
}
