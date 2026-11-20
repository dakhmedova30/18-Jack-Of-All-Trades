import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { getSalesMonthSummary } from '../api/sales';
import type { SalesMonthSummary } from '../types';

/** Loads this month's sales summary. Call `reload()` to refetch. */
export function useSalesMonthSummary() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    data?: SalesMonthSummary;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSalesMonthSummary()
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
