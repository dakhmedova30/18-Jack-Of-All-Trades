import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { getExpenseMonthBreakdown } from '../api/expenses';
import type { ExpenseMonthBreakdown } from '../types';

/** Loads this month's restock vs running-cost split. Call `reload()` to refetch. */
export function useExpenseMonthBreakdown() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    data?: ExpenseMonthBreakdown;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExpenseMonthBreakdown()
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
