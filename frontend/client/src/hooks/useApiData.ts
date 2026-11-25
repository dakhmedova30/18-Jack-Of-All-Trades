import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';

export interface ApiData<T> {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/**
 * Loads `load()` once, as the useInventoryInsights-style hooks do. Call `reload()` to refetch.
 * `load` must keep its identity between renders (an imported API function, not an inline arrow),
 * or it reloads on every render.
 */
export function useApiData<T>(load: () => Promise<T>): ApiData<T> {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ token: number; data?: T; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setResult({ token: reloadToken, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ token: reloadToken, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [load, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    data: result?.data,
    error: result?.error,
    loading: result?.token !== reloadToken,
    reload,
  };
}
