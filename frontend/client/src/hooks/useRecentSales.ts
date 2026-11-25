import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { listSales } from '../api/sales';
import type { Sale } from '../types';

/**
 * The `limit` most recent sales by sale date (newest first), from the existing
 * list endpoint, which already sorts that way. Call `reload()` to refetch.
 */
export function useRecentSales(limit: number) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ key: string; sales?: Sale[]; error?: string } | null>(
    null,
  );
  const requestKey = JSON.stringify([limit, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    listSales({ page: 1, pageSize: limit })
      .then((page) => {
        if (!cancelled) setResult({ key: requestKey, sales: page.data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ key: requestKey, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, limit]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return {
    sales: result?.sales,
    error: result?.error,
    loading: result?.key !== requestKey,
    reload,
  };
}
