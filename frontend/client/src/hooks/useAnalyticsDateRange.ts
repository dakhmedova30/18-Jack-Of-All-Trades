import { useCallback, useEffect, useState } from 'react';
import { getAnalyticsDateRange } from '../api/analytics';
import { getErrorMessage } from '../api/http';
import type { AnalyticsDateRange } from '../types';

/** Loads the first and last day with records once, for the date filter. Call `reload()` to refetch. */
export function useAnalyticsDateRange() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    data?: AnalyticsDateRange;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAnalyticsDateRange()
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
