import { describe, expect, it } from 'vitest';
import { dateInputValueToIso, formatDate, isoToDateInputValue } from './date';

describe('date utilities', () => {
  it('formats an ISO date for display', () => {
    expect(formatDate('2026-10-13T00:00:00.000Z')).toBe('Oct 13, 2026');
  });

  it('extracts a date input value from an ISO timestamp', () => {
    expect(isoToDateInputValue('2026-10-13T19:45:00.000Z')).toBe('2026-10-13');
  });

  it('converts a date input value to UTC midnight', () => {
    expect(dateInputValueToIso('2026-10-13')).toBe('2026-10-13T00:00:00.000Z');
  });

  it('returns null for invalid date input values', () => {
    expect(dateInputValueToIso('not-a-date')).toBeNull();
    expect(dateInputValueToIso('2026-02-30')).toBeNull();
  });
});
