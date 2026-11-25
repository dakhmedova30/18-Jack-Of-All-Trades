import { useRef, useState } from 'react';
import { ApiError } from '../api/http';
import {
  downloadCsv,
  encodeCsv,
  parseCsv,
  type CsvImportResult,
  type ParsedCsv,
} from '../utils/csv';
import { ConfirmDialog } from './ConfirmDialog';

function rowError(reason: unknown): string {
  if (reason instanceof ApiError) {
    if (reason.fieldErrors.length > 0) {
      return reason.fieldErrors.map(({ field, message }) => `${field}: ${message}`).join('; ');
    }
    if (reason.message === 'Request body is not valid JSON') {
      return 'The server could not read one or more row values. Check dates, numbers, and items.';
    }
  }
  return reason instanceof Error ? reason.message : String(reason);
}

function rowKey(record: Record<string, string>, headers: string[]): string {
  const rawId = record.id?.trim();
  const id = rawId ? Number(rawId) : undefined;
  if (id !== undefined && Number.isSafeInteger(id) && id > 0) return `id:${id}`;
  return `row:${JSON.stringify(headers.map((header) => record[header]))}`;
}

interface CsvTransferProps<T> {
  filename: string;
  headers: string[];
  loadRows: () => Promise<T[]>;
  exportRow: (record: T) => Array<string | number | boolean | null>;
  importHeaders?: string[];
  importRow?: (record: Record<string, string>) => Promise<CsvImportResult>;
  onImported?: () => void;
}

export function CsvTransfer<T>({
  filename,
  headers,
  loadRows,
  exportRow,
  importHeaders,
  importRow,
  onImported,
}: CsvTransferProps<T>) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingImport, setPendingImport] = useState<ParsedCsv | null>(null);

  async function exportRecords() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const records = await loadRows();
      downloadCsv(`${filename}.csv`, encodeCsv(headers, records.map(exportRow)));
      setMessage(`Exported ${records.length} record(s).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The CSV export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    if (!importRow || !importHeaders) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const parsed = parseCsv(await file.text());
      const fileHeaders = parsed.headers;
      const missingHeaders = importHeaders.filter((header) => !fileHeaders.includes(header));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required column(s): ${missingHeaders.join(', ')}.`);
      }
      if (parsed.records.length === 0) throw new Error('The CSV has no data rows to import.');
      setPendingImport(parsed);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The CSV import failed.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function confirmImport() {
    if (!pendingImport || !importRow) return;
    setBusy(true);
    let created = 0;
    let updated = 0;
    const failures: string[] = [];
    const duplicates: number[] = [];
    const importedKeys = new Set<string>();
    try {
      for (let index = 0; index < pendingImport.records.length; index += 1) {
        const record = pendingImport.records[index];
        const key = rowKey(record, pendingImport.headers);
        const row = pendingImport.rowNumbers[index];
        if (importedKeys.has(key)) {
          duplicates.push(row);
          continue;
        }
        try {
          const result = await importRow(record);
          importedKeys.add(key);
          if (result === 'created') created += 1;
          else updated += 1;
        } catch (reason) {
          failures.push(`Row ${row}: ${rowError(reason)}`);
        }
      }
      if (created + updated > 0) onImported?.();
      setMessage(
        `Imported ${created} new and updated ${updated} record(s).` +
          (duplicates.length
            ? ` Skipped ${duplicates.length} duplicate row(s): ${duplicates.join(', ')}.`
            : ''),
      );
      if (failures.length > 0)
        setError(`${failures.length} row(s) failed:\n${failures.join('\n')}`);
    } finally {
      setBusy(false);
      setPendingImport(null);
    }
  }

  return (
    <div className={`csv-transfer${importRow && importHeaders ? '' : ' csv-transfer--export-only'}`}>
      <div className="csv-transfer__buttons">
        <button
          type="button"
          className="button button--ghost"
          disabled={busy}
          onClick={() => void exportRecords()}
        >
          Export CSV
        </button>
        {importRow && importHeaders && (
          <>
            <button
              type="button"
              className="button button--ghost"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              Import CSV
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              aria-label={`Import ${filename} CSV`}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void importFile(file);
              }}
            />
          </>
        )}
      </div>
      {message && (
        <span className="muted" role="status">
          {message}
        </span>
      )}
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
      {pendingImport && (
        <ConfirmDialog
          title="Confirm CSV Import"
          message={`Import ${pendingImport.records.length} row(s)? Existing records may be updated, and this cannot be undone. Duplicate IDs and identical rows without IDs are skipped after the first successful import.`}
          confirmLabel="Import CSV"
          pendingLabel="Importing…"
          danger={false}
          onConfirm={confirmImport}
          onCancel={() => {
            if (!busy) setPendingImport(null);
          }}
        />
      )}
    </div>
  );
}
