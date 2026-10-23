import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { listSales, type ListSalesParams } from '../api/sales';
import type { Paginated, Sale } from '../types';

interface SalesResult {
  key: string;
  data?: Paginated<Sale>;
  error?: string;
}

/**
 * Loads one page of sales. While a new page loads, the previous data stays on
 * screen (no flicker) and `loading` is true. Call `reload()` after a mutation.
 */
export function useSales({ page, pageSize, search, sort, order }: ListSalesParams) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<SalesResult | null>(null);
  const [lastData, setLastData] = useState<Paginated<Sale> | undefined>(undefined);

  const requestKey = JSON.stringify([page, pageSize, search, sort, order, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    listSales({ page, pageSize, search, sort, order })
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
