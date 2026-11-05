/** How dates are shown in tables: "Oct 13, 2026", "2026-10-13", "13/10/2026" or "10/13/2026". */
export type DateFormat = 'medium' | 'iso' | 'dmy' | 'mdy';

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  medium: 'Oct 13, 2026',
  iso: '2026-10-13',
  dmy: '13/10/2026',
  mdy: '10/13/2026',
};

/** ISO timestamp -> "Oct 13, 2026" (or the chosen format), for display. */
export function formatDate(iso: string, format: DateFormat = 'medium'): string {
  if (format === 'medium') {
    return new Date(iso).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (format === 'iso') return `${year}-${month}-${day}`;
  return format === 'dmy' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

/** ISO timestamp -> "2026-10-13", for pre-filling a `<input type="date">`. */
export function isoToDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

/** "2026-10-13" -> full ISO timestamp at UTC midnight, invalid input -> null. */
export function dateInputValueToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True for a real calendar date written "YYYY-MM-DD" ("2026-02-30" is not). */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** "2026-10-29" + 3 -> "2026-11-01" (UTC days, so no daylight-saving surprises). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`: 0 for the same day, negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / DAY_MS,
  );
}

/** The 1st of `date`'s month, moved by `months`: ("2026-10-29", -11) -> "2025-11-01". */
export function startOfMonth(date: string, months = 0): string {
  const [year, month] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
}
