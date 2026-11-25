import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCsv, encodeCsv, parseCsv } from './csv';

describe('CSV helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('round-trips commas, quotes, line breaks, empty values and a UTF-8 BOM', () => {
    const csv = encodeCsv(['name', 'note', 'empty'], [['Garden, set', 'A "special"\nitem', null]]);

    expect(parseCsv(`\uFEFF${csv}`)).toEqual({
      headers: ['name', 'note', 'empty'],
      records: [{ name: 'Garden, set', note: 'A "special"\nitem', empty: '' }],
      rowNumbers: [2],
    });
  });

  it('rejects inconsistent rows and unclosed quoted fields', () => {
    expect(() => parseCsv('name,quantity\n"Item')).toThrow('unclosed quoted field');
    expect(() => parseCsv('name,quantity\nItem')).toThrow('expected 2');
  });

  it('rejects duplicate headers', () => {
    expect(() => parseCsv('name,name\nFirst,Second')).toThrow('duplicate column names');
  });

  it('protects formula-like text and reverses the prefix without changing numbers or apostrophes', () => {
    const values = ['=1+1', '+cmd', '-text', '@name', '\tcmd', '\rcmd', "'=literal", "''@literal"];
    const csv = encodeCsv(
      ['value', 'number'],
      values.map((value) => [value, -12]),
    );
    for (const value of values) expect(csv).toContain(`'${value}`);
    expect(parseCsv(csv).records).toEqual(values.map((value) => ({ value, number: '-12' })));
    expect(csv).toContain(',-12');
  });

  it('reports the starting physical line after blank lines and multiline cells', () => {
    const csv = 'id,name\r\n\r\n1,"first\r\nsecond"\r\n\r\n2,bad\r\n';
    expect(parseCsv(csv).rowNumbers).toEqual([3, 6]);
    expect(() => parseCsv(`${csv}3`)).toThrow('CSV row 7 has 1 values; expected 2');
  });

  it('revokes a download URL only after the click has completed', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadCsv('test.csv', 'name');
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
