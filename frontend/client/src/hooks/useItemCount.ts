import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { listItems } from '../api/items';

/**
 * Total number of inventory items, read from the list endpoint's `total` with
 * a one-row page so no new server route is needed. Call `reload()` to refetch.
 */
export function useItemCount() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ token: number; count?: number; error?: string } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    listItems({ page: 1, pageSize: 1 })
      .then((page) => {
        if (!cancelled) setResult({ token: reloadToken, count: page.total });
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
    count: result?.count,
    error: result?.error,
    loading: result?.token !== reloadToken,
    reload,
  };
}
