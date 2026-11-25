import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { getInventoryInsights } from '../api/items';
import type { InventoryInsights } from '../types';

/**
 * Loads stock value and the best sellers, for this calendar month or, with `days`, the last that
 * many days. Call `reload()` to refetch.
 */
export function useInventoryInsights(days?: number) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    data?: InventoryInsights;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInventoryInsights(days)
      .then((data) => {
        if (!cancelled) setResult({ token: reloadToken, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ token: reloadToken, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, days]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    data: result?.data,
    error: result?.error,
    loading: result?.token !== reloadToken,
    reload,
  };
}
