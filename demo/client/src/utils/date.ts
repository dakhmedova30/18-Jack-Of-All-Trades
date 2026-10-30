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
