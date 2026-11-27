import { describe, expect, it } from 'vitest';
import { orList } from './ChartCard';

describe('orList', () => {
  it('names the chosen channels or tags as a sentence would', () => {
    expect(orList([])).toBe('');
    expect(orList(['Online'])).toBe('Online');
    expect(orList(['Online', 'Market'])).toBe('Online or Market');
    expect(orList(['Online', 'Market', 'Etsy'])).toBe('Online, Market or Etsy');
    expect(orList(['a', 'b', 'c', 'd'])).toBe('a, b, c or d');
  });

  it('keeps commas inside a name as they are', () => {
    expect(orList(['fees, misc', 'rent'])).toBe('fees, misc or rent');
  });
});
