import { describe, expect, it } from 'vitest';
import { centsToInputValue, formatCents, formatCentsCompact, parseDollarsToCents } from './money';

describe('money utilities', () => {
  it('formats cents for display and input fields', () => {
    expect(formatCents(1850)).toBe('18.50 CAD');
    expect(formatCentsCompact(125000)).toBe('$1.3K');
    expect(centsToInputValue(1850)).toBe('18.50');
  });

  it('parses dollar amounts into cents', () => {
    expect(parseDollarsToCents('18.5')).toBe(1850);
    expect(parseDollarsToCents('0.09')).toBe(9);
    expect(parseDollarsToCents(' 12 ')).toBe(1200);
  });

  it('returns null for invalid dollar amounts', () => {
    expect(parseDollarsToCents('not a price')).toBeNull();
    expect(parseDollarsToCents('1.234')).toBeNull();
    expect(parseDollarsToCents('$5')).toBeNull();
  });

  it('parses negative amounts, so forms can say the amount is out of range', () => {
    // The forms reject these with "must be between 0.00 and …" rather than "enter a price".
    expect(parseDollarsToCents('-2')).toBe(-200);
    expect(parseDollarsToCents('-0.50')).toBe(-50);
  });
});
