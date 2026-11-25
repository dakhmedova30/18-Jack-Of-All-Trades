import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiData } from '../../hooks/useApiData';
import type { AnalyticsDateRange, DateRange } from '../../types';
import type { ChartPeriod } from './analyticsPeriod';

interface FitWidthProps {
  /** The width to draw at until the box is measured (and in tests, which can't measure). */
  fallback: number;
  children: (width: number) => ReactNode;
}

/**
 * Draws a chart at the width its box really has, so its text stays the same size on a phone and
 * a wide screen instead of shrinking or growing with the whole drawing.
 */
export function FitWidth({ fallback, children }: FitWidthProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = Math.round(entry?.contentRect.width ?? 0);
      if (measured > 0) setWidth(measured);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="chart-fit">
      {children(width ?? fallback)}
    </div>
  );
}

interface Size {
  width: number;
  height: number;
}

interface FitSizeProps {
  /** The size to draw at until the box is measured (and in tests, which can't measure). */
  fallback: Size;
  children: (width: number, height: number) => ReactNode;
}

/**
 * Like FitWidth, but the chart also takes the height its box is given (at least 260px; see
 * .chart-fill), e.g. to end level with the cards beside it. The drawing sits on top of the box, so
 * drawing it taller never makes the box taller.
 */
export function FitSize({ fallback, children }: FitSizeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      const height = Math.round(entry?.contentRect.height ?? 0);
      if (width > 0 && height > 0) {
        setSize((current) =>
          current?.width === width && current.height === height ? current : { width, height },
        );
      }
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size ?? fallback;
  return (
    <div ref={ref} className="chart-fill">
      {children(width, height)}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  /** What the chart covers, e.g. "Last 12 months", shown beside the title. */
  context?: string;
  /** Takes the whole row instead of half of it. */
  wide?: boolean;
  /** Grows to fill the height around it; pair it with a FitSize chart. */
  fill?: boolean;
  /** One sentence on what the chart says, under it. */
  insight?: ReactNode;
  children: ReactNode;
}

/** One chart on an Analytics page: a titled card, the chart, then its insight. */
export function ChartCard({
  title,
  context,
  wide = false,
  fill = false,
  insight,
  children,
}: ChartCardProps) {
  const classes = ['card', 'analytics-card', 'chart-card'];
  if (wide) classes.push('chart-card--wide');
  if (fill) classes.push('chart-card--fill');
  return (
    <section className={classes.join(' ')}>
      <header className="chart-card__header">
        <h2>{title}</h2>
        {context && <span className="chart-card__context">{context}</span>}
      </header>
      {children}
      {insight && <p className="analytics-insight">{insight}</p>}
    </section>
  );
}

interface ChartSectionProps<T> {
  resource: ApiData<T>;
  /** What's loading, for the loading and error text, e.g. "sales trends". */
  label: string;
  children: (data: T) => ReactNode;
}

/** A page's charts, once their data loads; until then a loading line, or the error with Retry. */
export function ChartSection<T>({ resource, label, children }: ChartSectionProps<T>) {
  const { data, error, loading, reload } = resource;
  if (error) {
    return (
      <div className="banner banner--error" role="alert">
        Couldn't load {label}: {error}{' '}
        <button type="button" className="link-button" onClick={reload}>
          Retry
        </button>
      </div>
    );
  }
  if (!data) return <p className="empty-state">Loading {label}…</p>;
  // A new timeframe is loading: keep the charts, dimmed, rather than blanking the page.
  return (
    <div className={`chart-grid${loading ? ' is-loading' : ''}`} aria-busy={loading}>
      {children(data)}
    </div>
  );
}

interface PeriodChartsSectionProps {
  /** The record dates the date filter needs, as useAnalyticsDateRange gives them. */
  dates: { data?: AnalyticsDateRange; error?: string; reload: () => void };
  /** The chosen period; null until the record dates arrive. */
  period: ChartPeriod | null;
  /** What's loading, for the loading and error text, e.g. "sales trends". */
  label: string;
  /** The charts for the settled period. */
  children: (requested: DateRange) => ReactNode;
}

/** A deeper page's charts once its date filter is ready; until then a loading line, or the error with Retry. */
export function PeriodChartsSection({ dates, period, label, children }: PeriodChartsSectionProps) {
  if (dates.error) {
    return (
      <div className="banner banner--error" role="alert">
        Couldn't load {label}: {dates.error}{' '}
        <button type="button" className="link-button" onClick={dates.reload}>
          Retry
        </button>
      </div>
    );
  }
  if (!period) return <p className="empty-state">Loading {label}…</p>;
  return children(period.requested);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08" -> "Aug 2026", for hover text and tables, where the year matters. */
export function monthName(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** How a chart's period is split up, as the server chose for its length. */
export type Granularity = 'day' | 'week' | 'month';

/**
 * A bucket's key as a date, for tables and hover text: "Aug 2026" for a month (key "2026-08"),
 * "Oct 5, 2026" for a day or a week (key "2026-10-05", a week's being its Monday).
 */
export function bucketDate(key: string, granularity: Granularity): string {
  if (granularity === 'month') return monthName(key);
  const [year, month, day] = key.split('-');
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`;
}

/** A bucket in a sentence: "Aug 2026", "the week of Oct 5, 2026" or "Oct 5, 2026". */
export function bucketPhrase(key: string, granularity: Granularity): string {
  const date = bucketDate(key, granularity);
  return granularity === 'week' ? `the week of ${date}` : date;
}

/** A table's first column heading, over bucketDate values. */
export const BUCKET_HEADING: Record<Granularity, string> = {
  day: 'Day',
  week: 'Week of',
  month: 'Month',
};

/** "3 months", "1 week", "12 days". */
export function bucketCount(count: number, granularity: Granularity): string {
  return `${count.toLocaleString()} ${granularity}${count === 1 ? '' : 's'}`;
}

/** Whole-number percentage of `total`, 0 when there is no total. */
export function percentOf(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** The index of the largest value (the first, on ties), or -1 for an empty list. */
export function indexOfMax(values: number[]): number {
  return values.reduce((best, value, i) => (best === -1 || value > values[best]! ? i : best), -1);
}
