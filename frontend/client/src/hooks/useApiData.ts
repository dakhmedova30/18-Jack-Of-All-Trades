import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';

export interface ApiData<T> {
  /** The latest data, kept on screen while a new request loads. */
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
}

interface Result<T> {
  token: number;
  load: () => Promise<T>;
  data?: T;
  error?: string;
}

/**
 * Loads `load()`, again whenever `load` changes (e.g. a useCallback over the chosen period), as the
 * useInventoryInsights-style hooks do. Call `reload()` to refetch. While a new request loads, the
 * previous data stays and `loading` is true. `load` must keep its identity between renders (an
 * imported API function, or a useCallback), or it reloads on every render.
 */
export function useApiData<T>(load: () => Promise<T>): ApiData<T> {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const [lastData, setLastData] = useState<T | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (cancelled) return;
        setResult({ token: reloadToken, load, data });
        setLastData(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ token: reloadToken, load, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [load, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const isCurrent = result?.token === reloadToken && result.load === load;

  return {
    data: lastData,
    error: isCurrent ? result?.error : undefined,
    loading: !isCurrent,
    reload,
  };
}
