import { useCallback, useEffect, useState } from 'react';
import { listItems, type ListItemsParams } from '../api/items';
import { getErrorMessage } from '../api/http';
import type { Item, Paginated } from '../types';

interface ItemsResult {
  key: string;
  data?: Paginated<Item>;
  error?: string;
}

/**
 * Loads one page of items. While a new page loads, the previous data stays on
 * screen (no flicker) and `loading` is true. Call `reload()` after a mutation.
 */
export function useItems({ page, pageSize, search }: ListItemsParams) {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<ItemsResult | null>(null);
  const [lastData, setLastData] = useState<Paginated<Item> | undefined>(undefined);

  const requestKey = JSON.stringify([page, pageSize, search, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    listItems({ page, pageSize, search })
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
  }, [requestKey, page, pageSize, search]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const isCurrent = result?.key === requestKey;

  return {
    data: lastData,
    error: isCurrent ? result.error : undefined,
    loading: !isCurrent,
    reload,
  };
}
