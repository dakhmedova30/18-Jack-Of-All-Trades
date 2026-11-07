import type { Paginated } from '../types';

export type CsvRecord = Record<string, string>;
export type CsvImportResult = 'created' | 'updated';

export async function fetchAllPages<T>(
  loadPage: (page: number, pageSize: number) => Promise<Paginated<T>>,
): Promise<T[]> {
  const firstPage = await loadPage(1, 100);
  const records = [...firstPage.data];
  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    records.push(...(await loadPage(page, 100)).data);
  }
  return records;
}

export function csvInteger(record: CsvRecord, column: string): number {
  const text = record[column]?.trim() ?? '';
  const value = Number(text);
  if (!text || !Number.isSafeInteger(value)) throw new Error(`${column} must be a whole number.`);
  return value;
}

export function csvStringArray(record: CsvRecord, column: string): string[] {
  const text = record[column]?.trim() ?? '';
  if (!text) return [];
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${column} must contain a JSON array of strings.`);
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${column} must contain a JSON array of strings.`);
  }
  return value;
}

export function csvJsonArray<T>(
  record: CsvRecord,
  column: string,
  isValue: (value: unknown) => value is T,
): T[] {
  const text = record[column]?.trim() ?? '';
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${column} must contain a JSON array.`);
  }
  if (!Array.isArray(value) || !value.every(isValue)) {
    throw new Error(`${column} must contain a valid JSON array.`);
  }
  return value;
}

export function parseCsv(text: string): { headers: string[]; records: CsvRecord[] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let afterQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        cell += character;
      }
    } else if (afterQuote && character === ',') {
      row.push(cell);
      cell = '';
      afterQuote = false;
    } else if (afterQuote && (character === '\n' || character === '\r')) {
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      afterQuote = false;
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else if (afterQuote) {
      throw new Error('The CSV has unexpected content after a quoted field.');
    } else if (character === '"') {
      if (cell.length !== 0) throw new Error('The CSV contains a quote inside an unquoted field.');
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  if (rows.length === 0) throw new Error('The CSV file is empty.');

  const headers = rows[0].map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim(),
  );
  if (headers.some((header) => !header)) throw new Error('The CSV has an empty column name.');
  if (new Set(headers).size !== headers.length) throw new Error('The CSV has duplicate column names.');

  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${values.length} values; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
  return { headers, records };
}

export function encodeCsv(headers: string[], rows: Array<Array<string | number | boolean | null>>): string {
  const escape = (value: string | number | boolean | null) => {
    const text = value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map((values) => values.map(escape).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
