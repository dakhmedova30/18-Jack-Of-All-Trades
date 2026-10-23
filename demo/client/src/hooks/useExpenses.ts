import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { listExpenses, type ListExpensesParams } from '../api/expenses';
import type { Expense, Paginated } from '../types';

interface ExpensesResult {
  key: string;
  data?: Paginated<Expense>;
  error?: string;
}

/**
 * Loads one page of expenses. While a new page loads, the previous data stays
 * on screen (no flicker) and `loading` is true. Call `reload()` after a mutation.
 */
export function useExpenses({ page, pageSize, search, sort, order }: ListExpensesParams) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<ExpensesResult | null>(null);
  const [lastData, setLastData] = useState<Paginated<Expense> | undefined>(undefined);

  const requestKey = JSON.stringify([page, pageSize, search, sort, order, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    listExpenses({ page, pageSize, search, sort, order })
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
  }, [requestKey, page, pageSize, search, sort, order]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const isCurrent = result?.key === requestKey;

  return {
    data: lastData,
    error: isCurrent ? result.error : undefined,
    loading: !isCurrent,
    reload,
  };
}
