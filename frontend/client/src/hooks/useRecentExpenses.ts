import { useCallback, useEffect, useState } from 'react';
import { listExpenses } from '../api/expenses';
import { getErrorMessage } from '../api/http';
import type { Expense } from '../types';

/**
 * The `limit` most recent expenses by date (newest first), from the existing
 * list endpoint, which already sorts that way. Call `reload()` to refetch.
 */
export function useRecentExpenses(limit: number) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    expenses?: Expense[];
    error?: string;
  } | null>(null);
  const requestKey = JSON.stringify([limit, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    listExpenses({ page: 1, pageSize: limit })
      .then((page) => {
        if (!cancelled) setResult({ key: requestKey, expenses: page.data });
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
    expenses: result?.expenses,
    error: result?.error,
    loading: result?.key !== requestKey,
    reload,
  };
}
