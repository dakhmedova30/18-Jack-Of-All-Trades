import { describe, expect, it } from 'vitest';
import { encodeCsv, parseCsv } from './csv';

describe('CSV helpers', () => {
  it('round-trips commas, quotes, line breaks, empty values and a UTF-8 BOM', () => {
    const csv = encodeCsv(['name', 'note', 'empty'], [['Garden, set', 'A "special"\nitem', null]]);

    expect(parseCsv(`\uFEFF${csv}`)).toEqual({
      headers: ['name', 'note', 'empty'],
      records: [{ name: 'Garden, set', note: 'A "special"\nitem', empty: '' }],
    });
  });

  it('rejects inconsistent rows and unclosed quoted fields', () => {
    expect(() => parseCsv('name,quantity\n"Item')).toThrow('unclosed quoted field');
    expect(() => parseCsv('name,quantity\nItem')).toThrow('expected 2');
  });

  it('rejects duplicate headers', () => {
    expect(() => parseCsv('name,name\nFirst,Second')).toThrow('duplicate column names');
  });
});
