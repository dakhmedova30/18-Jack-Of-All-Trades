import { useCallback, useEffect, useState } from 'react';
import { getAnalyticsSummary } from '../api/analytics';
import { getErrorMessage } from '../api/http';
import type { AnalyticsRange, AnalyticsSummary } from '../types';

interface SummaryResult {
  key: string;
  data?: AnalyticsSummary;
  error?: string;
}

/**
 * Loads the analytics summary, refetching whenever `range` (the page-wide
 * "Show by" filter) changes. Call `reload()` to refetch as-is.
 */
export function useAnalyticsSummary(range: AnalyticsRange) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [lastData, setLastData] = useState<AnalyticsSummary | undefined>(undefined);

  const requestKey = JSON.stringify([range, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    getAnalyticsSummary(range)
      .then((data) => {
        if (cancelled) return;
        setResult({ key: requestKey, data });
        setLastData(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ key: requestKey, error: getErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, range]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const isCurrent = result?.key === requestKey;

  return {
    data: lastData,
    error: isCurrent ? result?.error : undefined,
    loading: !isCurrent,
    reload,
  };
}
