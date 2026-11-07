import type { AnalyticsRange } from '../types';

/**
 * The period the Home page summarizes, from the summary API's fixed ranges. Month is the
 * default, as Home has always shown; the choice is remembered in this browser.
 */
export interface HomeRangeOption {
  value: AnalyticsRange;
  /** In the dropdown: "Last 7 days". */
  label: string;
  /** After a tile label or caption: "Revenue · last 7 days". */
  period: string;
  /** After "No sales": "No sales in the last 7 days", "No sales yet this month". */
  noneYet: string;
}

export const HOME_RANGES: HomeRangeOption[] = [
  { value: 'week', label: 'Last 7 days', period: 'last 7 days', noneYet: 'in the last 7 days' },
  { value: 'month', label: 'This month', period: 'this month', noneYet: 'yet this month' },
  { value: 'ytd', label: 'This year', period: 'this year', noneYet: 'yet this year' },
  {
    value: '12months',
    label: 'Last 12 months',
    period: 'last 12 months',
    noneYet: 'in the last 12 months',
  },
];

export const DEFAULT_HOME_RANGE: AnalyticsRange = 'month';

const STORAGE_KEY = 'jat:home-range';

export function homeRangeOption(range: AnalyticsRange): HomeRangeOption {
  return HOME_RANGES.find((option) => option.value === range) ?? HOME_RANGES[1]!;
}

/** The range last chosen in this browser, or Month. Storage can be blocked or hold junk. */
export function loadHomeRange(): AnalyticsRange {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return HOME_RANGES.some((option) => option.value === saved)
      ? (saved as AnalyticsRange)
      : DEFAULT_HOME_RANGE;
  } catch {
    return DEFAULT_HOME_RANGE;
  }
}

export function saveHomeRange(range: AnalyticsRange): void {
  try {
    localStorage.setItem(STORAGE_KEY, range);
  } catch {
    // Storage blocked: the choice still applies until the page is reloaded.
  }
}
