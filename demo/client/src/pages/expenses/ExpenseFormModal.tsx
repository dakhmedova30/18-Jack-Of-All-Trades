import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createExpenseTag, listExpenseTags } from '../../api/expenseTags';
import { listItems } from '../../api/items';
import { getErrorMessage } from '../../api/http';
import { Modal } from '../../components/Modal';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { SelectWithAddRow } from '../../components/SelectWithAddRow';
import { dateInputValueToIso, isoToDateInputValue } from '../../utils/date';
import { centsToInputValue, formatCents, parseDollarsToCents } from '../../utils/money';
import type { Expense, ExpenseInput, Item } from '../../types';

interface ExpenseFormModalProps {
  /** Pass an expense to edit it ("Modify expense"); omit to record one ("Add expense"). */
  expense?: Expense;
  onCancel: () => void;
  onSubmit: (input: ExpenseInput) => Promise<void>;
}

interface LineState {
  key: string;
  /** '' means this line is free-text (uses `description`) instead of restocking an item. */
  itemId: string;
  description: string;
  quantity: string;
  unitCost: string;
}

let nextKey = 0;
function newLine(itemId = '', description = '', quantity = '1', unitCost = ''): LineState {
  nextKey += 1;
  return { key: `line-${nextKey}`, itemId, description, quantity, unitCost };
}

function linesFromExpense(expense?: Expense): LineState[] {
  if (!expense || expense.items.length === 0) return [newLine()];
  return expense.items.map((item) =>
    newLine(
      item.itemId === null ? '' : String(item.itemId),
      item.itemId === null ? item.itemName : '',
      String(item.quantity),
      centsToInputValue(item.unitCostCents),
    ),
  );
}

export function ExpenseFormModal({ expense, onCancel, onSubmit }: ExpenseFormModalProps) {
  const isEditing = expense !== undefined;

  const [items, setItems] = useState<Item[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const itemById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

  const [date, setDate] = useState(() => (expense ? isoToDateInputValue(expense.incurredAt) : ''));
  // The dropdown's choices, by name; null while loading.
  const [tagNames, setTagNames] = useState<string[] | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  // The first tag is the one the dropdown edits (and the one the charts group by).
  const [tag, setTag] = useState(() => expense?.tags[0] ?? '');
  const [tagError, setTagError] = useState<string | null>(null);
  const [lines, setLines] = useState<LineState[]>(() => linesFromExpense(expense));
  const [dateError, setDateError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listItems({ page: 1, pageSize: 100 })
      .then((page) => setItems(page.data))
      .catch((error: unknown) => setItemsError(getErrorMessage(error)));
    listExpenseTags()
      .then((tags) => setTagNames(tags.map((entry) => entry.name)))
      .catch((error: unknown) => setTagsError(getErrorMessage(error)));
  }, []);

  // An older expense's tag may not be in the list; offer it so the dropdown can show it.
  const tagOptions = tagNames && tag && !tagNames.includes(tag) ? [...tagNames, tag] : tagNames;

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
    const quantity = Number(line.quantity);
    const unitCostCents = parseDollarsToCents(line.unitCost);
    if (!Number.isInteger(quantity) || quantity <= 0 || unitCostCents === null) return null;
    return unitCostCents * quantity;
  }

  const grandTotalCents = lines.reduce((sum, line) => sum + (lineTotalCents(line) ?? 0), 0);

  function validate(): ExpenseInput | null {
    const incurredAt = dateInputValueToIso(date);
    setDateError(incurredAt ? null : 'Pick a date');
    setTagError(tag ? null : 'Pick a tag');

    const errors: Record<string, string> = {};
    const parsedLines = lines.map((line) => {
      const quantity = Number(line.quantity);
      const unitCostCents = parseDollarsToCents(line.unitCost);
      const hasItem = line.itemId !== '' && itemById.has(Number(line.itemId));

      if (!hasItem && !line.description.trim()) {
        errors[line.key] = 'Pick an item or enter a description';
      } else if (!Number.isInteger(quantity) || quantity <= 0) {
        errors[line.key] = 'Enter a whole number, 1 or more';
      } else if (unitCostCents === null) {
        errors[line.key] = 'Enter a cost like 5 or 5.99';
      }

      return {
        itemId: hasItem ? Number(line.itemId) : null,
        description: hasItem ? '' : line.description.trim(),
        quantity,
        unitCostCents: unitCostCents ?? 0,
      };
    });
    setLineErrors(errors);

    if (!incurredAt || !tag || Object.keys(errors).length > 0) return null;
    return {
      incurredAt,
      // The chosen tag first; keep any extra tags an older expense already has.
      tags: [...new Set([tag, ...(expense?.tags.slice(1) ?? [])])],
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
      title={isEditing ? 'Modify expense' : 'Add expense'}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            form="expense-form"
            className="button"
            disabled={submitting || !items || !tagNames}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="expense-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label>ID</label>
          <span className="form-row__static">{expense?.id ?? 'Assigned on save'}</span>
        </div>

        <div className="form-row">
          <label htmlFor="expense-date">Date</label>
          <div className="form-row__control">
            <input
              id="expense-date"
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

        <SelectWithAddRow
          id="expense-tag"
          label="Tag"
          noun="tag"
          options={tagOptions?.map((name) => ({ value: name, label: name })) ?? null}
          loadError={tagsError}
          value={tag}
          onChange={(value) => {
            setTag(value);
            setTagError(null);
          }}
          onAdd={async (name) => {
            const created = await createExpenseTag(name);
            setTagNames((current) => [...(current ?? []), created.name]);
            return created.name;
          }}
          error={tagError}
          maxLength={30}
          placeholder="e.g. shipping"
        />

        <div className="sale-lines">
          {itemsError && <p className="form-error">Could not load items: {itemsError}</p>}

          {items &&
            lines.map((line, index) => {
              const total = lineTotalCents(line);
              const isFreeText = line.itemId === '';
              return (
                <div className="expense-line" key={line.key}>
                  <span className="sale-line__index">{index + 1}</span>

                  <div className="sale-line__field">
                    <label htmlFor={`${line.key}-item`}>Item (optional)</label>
                    <select
                      id={`${line.key}-item`}
                      value={line.itemId}
                      onChange={(event) => updateLine(line.key, { itemId: event.target.value })}
                      aria-invalid={lineErrors[line.key] ? true : undefined}
                    >
                      <option value="">No item — free-text cost</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} (restock, {item.quantity} in stock)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sale-line__field">
                    <label htmlFor={`${line.key}-description`}>Description</label>
                    <input
                      id={`${line.key}-description`}
                      value={
                        isFreeText
                          ? line.description
                          : (itemById.get(Number(line.itemId))?.name ?? '')
                      }
                      onChange={(event) =>
                        updateLine(line.key, { description: event.target.value })
                      }
                      placeholder="Rent, packaging tape, …"
                      disabled={!isFreeText}
                      aria-invalid={lineErrors[line.key] ? true : undefined}
                    />
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

                  <div className="sale-line__field sale-line__field--qty">
                    <label htmlFor={`${line.key}-cost`}>Unit cost</label>
                    <input
                      id={`${line.key}-cost`}
                      value={line.unitCost}
                      onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                      inputMode="decimal"
                      placeholder="5.00"
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
