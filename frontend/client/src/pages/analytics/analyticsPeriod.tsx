import { useState } from 'react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { AnalyticsDateRange, DateRange } from '../../types';
import { formatDate, startOfMonth } from '../../utils/date';
import { AnalyticsFilters } from './AnalyticsFilters';

/** How long the period must stay still (e.g. while dragging the slider) before it reloads. */
export const RELOAD_DELAY_MS = 250;

/**
 * The period a page opens with: the 12 calendar months up to the latest record (like the old
 * "12 months" default), starting no earlier than the first record. With no records yet, the 12
 * months up to today.
 */
export function defaultPeriod({ firstDate, lastDate, today }: AnalyticsDateRange): DateRange {
  const to = lastDate ?? today;
  const yearBack = startOfMonth(to, -11);
  return { from: firstDate && firstDate > yearBack ? firstDate : yearBack, to };
}

/** "from Aug 1, 2025 to Oct 29, 2026" (or "on Oct 29, 2026"), for empty states and insights. */
export function periodPhrase({ from, to }: DateRange): string {
  return from === to ? `on ${formatDate(from)}` : `from ${formatDate(from)} to ${formatDate(to)}`;
}

function samePeriod(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to;
}

export interface ChartPeriod {
  /** What the filter shows, changing as the dates are typed or the slider dragged. */
  value: DateRange;
  /** `value` once it has stopped changing for RELOAD_DELAY_MS: the period to load. */
  requested: DateRange;
  /** The period the page opened with, for Reset. */
  initial: DateRange;
  setValue: (next: DateRange) => void;
}

/**
 * The period a deeper Analytics page's charts cover, set with the same filter as the main
 * Analytics page. It starts at defaultPeriod once the record dates are known; null until then.
 */
export function useChartPeriod(dates: AnalyticsDateRange | undefined): ChartPeriod | null {
  const [value, setValue] = useState<DateRange | null>(null);
  const initial = dates ? defaultPeriod(dates) : null;
  // The record dates arrive after the first render: start from the default period then.
  if (initial && !value) setValue(initial);
  const current = value ?? initial;
  const settled = useDebouncedValue(current, RELOAD_DELAY_MS);
  if (!current || !initial) return null;
  return { value: current, requested: settled ?? current, initial, setValue };
}

interface ChartFiltersProps {
  dates: AnalyticsDateRange;
  period: ChartPeriod;
}

/** The main Analytics page's date filter, driving a deeper page's charts. */
export function ChartFilters({ dates, period }: ChartFiltersProps) {
  return (
    <AnalyticsFilters
      dates={dates}
      value={period.value}
      onChange={period.setValue}
      onReset={() => period.setValue(period.initial)}
      isDefault={samePeriod(period.value, period.initial)}
    />
  );
}
