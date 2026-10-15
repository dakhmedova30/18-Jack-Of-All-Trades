import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listItems } from '../../api/items';
import { getErrorMessage } from '../../api/http';
import { Modal } from '../../components/Modal';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { dateInputValueToIso, isoToDateInputValue } from '../../utils/date';
import { formatCents } from '../../utils/money';
import type { Item, Sale, SaleInput } from '../../types';

interface SaleFormModalProps {
  /** Pass a sale to edit it ("Modify sale"); omit to record one ("Add sale"). */
  sale?: Sale;
  onCancel: () => void;
  onSubmit: (input: SaleInput) => Promise<void>;
}

interface LineState {
  key: string;
  itemId: string;
  quantity: string;
}

let nextKey = 0;
function newLine(itemId = '', quantity = '1'): LineState {
  nextKey += 1;
  return { key: `line-${nextKey}`, itemId, quantity };
}

function linesFromSale(sale?: Sale): LineState[] {
  if (!sale || sale.items.length === 0) return [newLine()];
  return sale.items.map((item) =>
    newLine(item.itemId === null ? '' : String(item.itemId), String(item.quantity)),
  );
}

export function SaleFormModal({ sale, onCancel, onSubmit }: SaleFormModalProps) {
  const isEditing = sale !== undefined;

  const [items, setItems] = useState<Item[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const itemById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

  const [date, setDate] = useState(() => (sale ? isoToDateInputValue(sale.soldAt) : ''));
  const [tags, setTags] = useState(() => sale?.tags.join(', ') ?? '');
  const [lines, setLines] = useState<LineState[]>(() => linesFromSale(sale));
  const [dateError, setDateError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listItems({ page: 1, pageSize: 100 })
      .then((page) => setItems(page.data))
      .catch((error: unknown) => setItemsError(getErrorMessage(error)));
  }, []);

  function updateLine(key: string, changes: Partial<LineState>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );
    setLineErrors((current) => ({ ...current, [key]: '' }));
  }

  function addLine() {
    setLines((current) => [...current, newLine()]);
  }

  function removeLine(key: string) {
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.key !== key) : current,
    );
  }

  function lineTotalCents(line: LineState): number | null {
    const item = itemById.get(Number(line.itemId));
    const quantity = Number(line.quantity);
    if (!item || !Number.isInteger(quantity) || quantity <= 0) return null;
    return item.unitPriceCents * quantity;
  }

  const grandTotalCents = lines.reduce((sum, line) => sum + (lineTotalCents(line) ?? 0), 0);

  function validate(): SaleInput | null {
    const soldAt = dateInputValueToIso(date);
    setDateError(soldAt ? null : 'Pick a date');

    const errors: Record<string, string> = {};
    const parsedLines = lines.map((line) => {
      const itemId = Number(line.itemId);
      const quantity = Number(line.quantity);
      if (!line.itemId || !itemById.has(itemId)) errors[line.key] = 'Pick an item';
      else if (!Number.isInteger(quantity) || quantity <= 0)
        errors[line.key] = 'Enter a whole number, 1 or more';
      return { itemId, quantity };
    });
    setLineErrors(errors);

    if (!soldAt || Object.keys(errors).length > 0) return null;
    return {
      soldAt,
      tags: [
        ...new Set(
          tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
      items: parsedLines,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = validate();
    if (!input) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(input);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Modify sale' : 'Add sale'}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="sale-form" className="button" disabled={submitting || !items}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="sale-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label>ID</label>
          <span className="form-row__static">{sale?.id ?? 'Assigned on save'}</span>
        </div>

        <div className="form-row">
          <label htmlFor="sale-date">Date</label>
          <div className="form-row__control">
            <input
              id="sale-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setDateError(null);
              }}
              aria-invalid={dateError ? true : undefined}
            />
            {dateError && <span className="field-error">{dateError}</span>}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="sale-tags">Tags</label>
          <div className="form-row__control">
            <input
              id="sale-tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Tag, Tag"
            />
          </div>
        </div>

        <div className="sale-lines">
          {itemsError && <p className="form-error">Could not load items: {itemsError}</p>}

          {items &&
            lines.map((line, index) => {
              const total = lineTotalCents(line);
              return (
                <div className="sale-line" key={line.key}>
                  <span className="sale-line__index">{index + 1}</span>

                  <div className="sale-line__field">
                    <label htmlFor={`${line.key}-item`}>Item</label>
                    <select
                      id={`${line.key}-item`}
                      value={line.itemId}
                      onChange={(event) => updateLine(line.key, { itemId: event.target.value })}
                      aria-invalid={lineErrors[line.key] ? true : undefined}
                    >
                      <option value="">Select…</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {formatCents(item.unitPriceCents)} ({item.quantity} in
                          stock)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sale-line__field sale-line__field--qty">
                    <label htmlFor={`${line.key}-qty`}>Qty</label>
                    <input
                      id={`${line.key}-qty`}
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                      inputMode="numeric"
                      aria-invalid={lineErrors[line.key] ? true : undefined}
                    />
                  </div>

                  <div className="sale-line__field sale-line__field--total">
                    <label>Total</label>
                    <span>{total === null ? '—' : formatCents(total)}</span>
                  </div>

                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                  >
                    <TrashIcon />
                  </button>

                  {lineErrors[line.key] && (
                    <span className="field-error sale-line__error">{lineErrors[line.key]}</span>
                  )}
                </div>
              );
            })}

          {!items && !itemsError && <p className="muted">Loading items…</p>}

          <button
            type="button"
            className="button button--secondary sale-lines__add"
            onClick={addLine}
          >
            Add <PlusIcon />
          </button>
        </div>

        <div className="sale-total">
          <span>Total</span>
          <span>{formatCents(grandTotalCents)}</span>
        </div>

        {submitError && <p className="form-error">{submitError}</p>}
      </form>
    </Modal>
  );
}
