const amountFormatter = new Intl.NumberFormat('en-CA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1850 -> "18.50 CAD" */
export function formatCents(cents: number): string {
  return `${amountFormatter.format(cents / 100)} CAD`;
}

const compactFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** 125000 -> "$1.3K", for chart axis labels where space is tight. */
export function formatCentsCompact(cents: number): string {
  return compactFormatter.format(cents / 100);
}

/** 1850 -> "18.50" (for pre-filling an input) */
export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** "18.5" -> 1850, invalid input -> null. Avoids float math by parsing the digits. */
export function parseDollarsToCents(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const [, dollars, fraction = ''] = match;
  return Number(dollars) * 100 + Number(fraction.padEnd(2, '0'));
}
