import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { getInventoryInsights } from '../api/items';
import type { InventoryInsights } from '../types';

/** Loads stock value and this month's best sellers. Call `reload()` to refetch. */
export function useInventoryInsights() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    data?: InventoryInsights;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInventoryInsights()
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
