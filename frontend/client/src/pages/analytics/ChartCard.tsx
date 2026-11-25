import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApiData } from '../../hooks/useApiData';

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

interface ChartCardProps {
  title: string;
  /** What the chart covers, e.g. "Last 12 months", shown beside the title. */
  context?: string;
  /** Takes the whole row instead of half of it. */
  wide?: boolean;
  /** One sentence on what the chart says, under it. */
  insight?: ReactNode;
  children: ReactNode;
}

/** One chart on a deeper Analytics page: a titled card, the chart, then its insight. */
export function ChartCard({ title, context, wide = false, insight, children }: ChartCardProps) {
  return (
    <section className={`card analytics-card chart-card${wide ? ' chart-card--wide' : ''}`}>
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
  const { data, error, reload } = resource;
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
  return <div className="chart-grid">{children(data)}</div>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08" -> "Aug 2026", for hover text and tables, where the year matters. */
export function monthName(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
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
