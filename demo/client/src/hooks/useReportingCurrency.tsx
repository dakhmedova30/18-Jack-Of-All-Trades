import { useEffect, useState } from 'react';
import { getCurrencyRates } from '../api/currencies';
import { getErrorMessage } from '../api/http';
import { useAuth } from './useAuth';
import type { CurrencyRates } from '../types';
import { convertCents, formatCentsIn } from '../utils/money';

export function useReportingCurrency() {
  const { business } = useAuth();
  const currency = business?.currency ?? 'CAD';
  const [rates, setRates] = useState<CurrencyRates | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrencyRates()
      .then((result) => {
        if (!cancelled) setRates(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(getErrorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function fromCad(cents: number): number | null {
    return rates ? convertCents(cents, 'CAD', currency, rates.cadPerUnit) : null;
  }

  function formatCad(cents: number): string {
    const converted = fromCad(cents);
    return converted === null ? '—' : formatCentsIn(converted, currency);
  }

  return { currency, rates, error, fromCad, formatCad };
}
