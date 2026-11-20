import { useCallback, useEffect, useState } from 'react';
import { getAnalyticsSummary } from '../api/analytics';
import { getErrorMessage } from '../api/http';
import type { AnalyticsRange, AnalyticsSummary, DateRange } from '../types';

interface SummaryResult {
  key: string;
  data?: AnalyticsSummary;
  error?: string;
}

/**
 * Loads the analytics summary for a "Show by" range or a period of days, optionally for one
 * channel's sales, refetching whenever either changes. Call `reload()` to refetch as-is.
 */
export function useAnalyticsSummary(query: AnalyticsRange | DateRange, channelId?: number) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [lastData, setLastData] = useState<AnalyticsSummary | undefined>(undefined);

  // Plain strings, so a new period object with the same dates doesn't refetch.
  const range = typeof query === 'string' ? query : undefined;
  const from = typeof query === 'string' ? '' : query.from;
  const to = typeof query === 'string' ? '' : query.to;
  const requestKey = JSON.stringify([range, from, to, channelId, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    getAnalyticsSummary(range ?? { from, to }, channelId)
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
  }, [requestKey, range, from, to, channelId]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const isCurrent = result?.key === requestKey;

  return {
    data: lastData,
    error: isCurrent ? result?.error : undefined,
    loading: !isCurrent,
    reload,
  };
}
