/** ISO timestamp -> "Oct 13, 2026", for display. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** ISO timestamp -> "2026-10-13", for pre-filling a `<input type="date">`. */
export function isoToDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

/** "2026-10-13" -> full ISO timestamp at UTC midnight, invalid input -> null. */
export function dateInputValueToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.toISOString();
}
