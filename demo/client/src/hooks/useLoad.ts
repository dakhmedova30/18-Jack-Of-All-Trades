import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';

/** Loads data with `load` on mount and whenever `deps` change; `reload()` refetches. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[] = []) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ token: string; data?: T; error?: string } | null>(null);
  const key = JSON.stringify([reloadToken, ...deps]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setResult({ token: key, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ token: key, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
    // `key` already covers `deps`; `load` is a fresh closure on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    data: result?.data,
    error: result?.error,
    loading: result?.token !== key,
    reload,
  };
}
