import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { getInventoryByTag } from '../api/analytics';
import type { InventoryByTag } from '../types';

/** Loads current stock by tag once. Call `reload()` to refetch. */
export function useInventoryByTag() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    data?: InventoryByTag;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInventoryByTag()
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
