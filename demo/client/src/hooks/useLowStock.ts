import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { getLowStock } from '../api/items';
import type { LowStock } from '../types';

/** Loads the low-stock summary once. Call `reload()` to refetch. */
export function useLowStock() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ token: number; data?: LowStock; error?: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    getLowStock()
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
