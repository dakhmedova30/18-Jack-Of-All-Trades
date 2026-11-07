import { useRef, useState } from 'react';
import { downloadCsv, encodeCsv, parseCsv, type CsvImportResult } from '../utils/csv';

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

  async function exportRecords() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const records = await loadRows();
      downloadCsv(
        `${filename}.csv`,
        encodeCsv(headers, records.map(exportRow)),
      );
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
      const { headers: fileHeaders, records } = parseCsv(await file.text());
      const missingHeaders = importHeaders.filter((header) => !fileHeaders.includes(header));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required column(s): ${missingHeaders.join(', ')}.`);
      }

      let created = 0;
      let updated = 0;
      const failures: string[] = [];
      for (let index = 0; index < records.length; index += 1) {
        try {
          const result = await importRow(records[index]);
          if (result === 'created') created += 1;
          else updated += 1;
        } catch (reason) {
          failures.push(`Row ${index + 2}: ${reason instanceof Error ? reason.message : String(reason)}`);
        }
      }
      if (created + updated > 0) onImported?.();
      setMessage(`Imported ${created} new and updated ${updated} record(s).`);
      if (failures.length > 0) {
        setError(`${failures.length} row(s) failed:\n${failures.join('\n')}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The CSV import failed.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div className="csv-transfer">
      <button
        type="button"
        className="button button--secondary"
        disabled={busy}
        onClick={() => void exportRecords()}
      >
        Export CSV
      </button>
      {importRow && importHeaders && (
        <>
          <button
            type="button"
            className="button button--secondary"
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
      {message && <span className="muted" role="status">{message}</span>}
      {error && <span className="form-error" role="alert">{error}</span>}
    </div>
  );
}
