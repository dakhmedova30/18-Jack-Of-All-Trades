import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createExpenseTag, listExpenseTags } from '../../api/expenseTags';
import { usePreferences } from '../../hooks/usePreferences';
import { useCurrency } from '../../hooks/useCurrency';
import { listItems } from '../../api/items';
import { getErrorMessage } from '../../api/http';
import { Modal } from '../../components/Modal';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { DescriptionRow } from '../../components/DescriptionRow';
import { SelectWithAddRow } from '../../components/SelectWithAddRow';
import { dateInputValueToIso, isoToDateInputValue } from '../../utils/date';
import { describeLines } from '../../utils/describeLines';
import {
  centsToInputValue,
  formatCents,
  MAX_AMOUNT_CENTS,
  MAX_AMOUNT_DISPLAY,
  parseDollarsToCents,
} from '../../utils/money';
import type { Expense, ExpenseInput, Item } from '../../types';
import { CURRENCY_CODES, EXPENSE_LINE_TYPES, type CurrencyCode, type ExpenseLineType } from '../../types';

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
  category: string;
  subcategory: string;
  manufacturer: string;
  type: ExpenseLineType;
}

let nextKey = 0;
function newLine(
  itemId = '',
  description = '',
  quantity = '1',
  unitCost = '',
  category = '',
  subcategory = '',
  manufacturer = '',
  type: ExpenseLineType = itemId ? 'product' : 'other',
): LineState {
  nextKey += 1;
  return { key: `line-${nextKey}`, itemId, description, quantity, unitCost, category, subcategory, manufacturer, type };
}

function linesFromExpense(expense?: Expense): LineState[] {
  if (!expense || expense.items.length === 0) return [newLine()];
  return expense.items.map((item) =>
    newLine(
      item.itemId === null ? '' : String(item.itemId),
      item.itemId === null ? item.itemName : '',
      String(item.quantity),
      centsToInputValue(item.unitCostCents),
      item.category,
      item.subcategory,
      item.manufacturer,
      item.type,
    ),
  );
}

export function ExpenseFormModal({ expense, onCancel, onSubmit }: ExpenseFormModalProps) {
  const isEditing = expense !== undefined;
  const accountCurrency = useCurrency();
  // A saved expense stays in the currency it was recorded in, and so do its line costs. In a list
  // row `currency` is the account currency its total was converted to for display, so the lines'
  // own currency is `originalCurrency`.
  const [currency, setCurrency] = useState<CurrencyCode>(
    (expense?.originalCurrency ?? accountCurrency) as CurrencyCode,
  );

  const [items, setItems] = useState<Item[] | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const itemById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);

  const [date, setDate] = useState(() => (expense ? isoToDateInputValue(expense.incurredAt) : ''));
  // The dropdown's choices, by name; null while loading.
  const [tagNames, setTagNames] = useState<string[] | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  // The first tag is the one the dropdown edits (and the one the charts group by).
  const { preferences } = usePreferences();
  const isNew = !expense;
  // A new expense starts on the default tag from Settings (checked against the list once it loads).
  const [tag, setTag] = useState(() =>
    expense ? (expense.tags[0] ?? '') : (preferences.defaultExpenseTag ?? ''),
  );
  const [tagError, setTagError] = useState<string | null>(null);
  // null = follow the lines ("Flower Print x 200, Shipping x 1"); a string = the user's own text.
  // An existing expense whose description is blank or was never changed keeps following its lines.
  const [customDescription, setCustomDescription] = useState<string | null>(() =>
    expense?.description && expense.description !== describeLines(expense.items)
      ? expense.description
      : null,
  );
  const [lines, setLines] = useState<LineState[]>(() => linesFromExpense(expense));
  const [hasUnsavedInput, setHasUnsavedInput] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listItems({ page: 1, pageSize: 100 })
      .then((page) => setItems(page.data))
      .catch((error: unknown) => setItemsError(getErrorMessage(error)));
    listExpenseTags()
      .then((tags) => {
        const names = tags.map((entry) => entry.name);
        setTagNames(names);
        if (isNew) setTag((current) => (names.includes(current) ? current : ''));
      })
      .catch((error: unknown) => setTagsError(getErrorMessage(error)));
  }, [isNew]);

  // An older expense's tag may not be in the list; offer it so the dropdown can show it.
  const tagOptions = tagNames && tag && !tagNames.includes(tag) ? [...tagNames, tag] : tagNames;

  function updateLine(key: string, changes: Partial<LineState>) {
    setHasUnsavedInput(true);
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...changes } : line)),
    );
    setLineErrors((current) => ({ ...current, [key]: '' }));
  }

  function addLine() {
    setHasUnsavedInput(true);
    setLines((current) => [...current, newLine()]);
  }

  function removeLine(key: string) {
    setHasUnsavedInput(true);
    setLines((current) =>
      current.length > 1 ? current.filter((line) => line.key !== key) : current,
    );
  }

  function handleCancel() {
    if (
      hasUnsavedInput &&
      !window.confirm('You have unsaved information. Are you sure you want to discard it?')
    ) {
      return;
    }
    onCancel();
  }

  function lineTotalCents(line: LineState): number | null {
    const quantity = Number(line.quantity);
    const unitCostCents = parseDollarsToCents(line.unitCost);
    if (!Number.isInteger(quantity) || quantity <= 0 || unitCostCents === null) return null;
    return unitCostCents * quantity;
  }

  const grandTotalCents = lines.reduce((sum, line) => sum + (lineTotalCents(line) ?? 0), 0);

  // A restock line is named after its item; a free-text line by its own description.
  const autoDescription = describeLines(
    lines.flatMap((line) => {
      const itemName =
        line.itemId === ''
          ? line.description.trim()
          : (itemById.get(Number(line.itemId))?.name ?? '');
      const quantity = Number(line.quantity);
      return itemName && Number.isInteger(quantity) && quantity > 0 ? [{ itemName, quantity }] : [];
    }),
  );

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
      } else if (unitCostCents < 0 || unitCostCents > MAX_AMOUNT_CENTS) {
        errors[line.key] = `Cost must be between 0.00 and ${MAX_AMOUNT_DISPLAY}`;
      }

      return {
        itemId: hasItem ? Number(line.itemId) : null,
        description: hasItem ? '' : line.description.trim(),
        quantity,
        unitCostCents: unitCostCents ?? 0,
        category: line.category.trim(),
        subcategory: line.subcategory.trim(),
        manufacturer: line.manufacturer.trim(),
        type: line.type,
      };
    });
    setLineErrors(errors);

    if (!incurredAt || !tag || Object.keys(errors).length > 0) return null;
    return {
      incurredAt,
      currency,
      // Blank lets the server describe it from the lines, the same text as autoDescription.
      description: customDescription?.trim() ?? '',
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
      onClose={handleCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={handleCancel}>
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
          <label htmlFor="expense-currency">Currency</label>
          <div className="form-row__control">
            <select
              id="expense-currency"
              value={currency}
              onChange={(event) => {
                setHasUnsavedInput(true);
                setCurrency(event.target.value as CurrencyCode);
              }}
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
        </div>
        <DescriptionRow
          id="expense-description"
          customDescription={customDescription}
          onChange={(value) => {
            setHasUnsavedInput(true);
            setCustomDescription(value);
          }}
          autoDescription={autoDescription}
          placeholder="Add a description (optional)"
        />

        <div className="sale-lines">
          {itemsError && <p className="form-error">Could not load items: {itemsError}</p>}

          {items &&
            lines.map((line, index) => {
              const total = lineTotalCents(line);
              const isFreeText = line.itemId === '';
              const errorId = `${line.key}-error`;
              return (
                <fieldset className="expense-line" key={line.key}>
                  <legend className="visually-hidden">Expense item {index + 1}</legend>
                  <span className="sale-line__index" aria-hidden="true">
                    {index + 1}
                  </span>

                  <div className="sale-line__field">
                    <label htmlFor={`${line.key}-item`}>Item (optional)</label>
                    <select
                      id={`${line.key}-item`}
                      value={line.itemId}
                      onChange={(event) =>
                        updateLine(line.key, {
                          itemId: event.target.value,
                          type: event.target.value ? 'product' : 'other',
                        })
                      }
                      aria-invalid={lineErrors[line.key] ? true : undefined}
                      aria-describedby={lineErrors[line.key] ? errorId : undefined}
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
                    <label htmlFor={`${line.key}-description`}>
                      Description
                      {isFreeText && (
                        <span className="required-marker" aria-hidden="true">
                          {' '}
                          *
                        </span>
                      )}
                    </label>
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
                      required={isFreeText}
                      aria-invalid={lineErrors[line.key] ? true : undefined}
                      aria-describedby={lineErrors[line.key] ? errorId : undefined}
                    />
                  </div>

                  <div className="sale-line__field sale-line__field--qty">
                    <label htmlFor={`${line.key}-qty`}>
                      Qty
                      <span className="required-marker" aria-hidden="true">
                        {' '}
                        *
                      </span>
                    </label>
                    <input
                      id={`${line.key}-qty`}
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                      inputMode="numeric"
                      required
                      aria-invalid={lineErrors[line.key] ? true : undefined}
                      aria-describedby={lineErrors[line.key] ? errorId : undefined}
                    />
                  </div>

                  <div className="sale-line__field sale-line__field--qty">
                    <label htmlFor={`${line.key}-cost`}>
                      <span>
                        Price per product
                        <span className="required-marker" aria-hidden="true">
                          {' '}
                          *
                        </span>
                      </span>
                      <span className="field-label__hint">{`0.00–${MAX_AMOUNT_DISPLAY}`}</span>
                    </label>
                    <input
                      id={`${line.key}-cost`}
                      value={line.unitCost}
                      onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                      inputMode="decimal"
                      placeholder="5.00"
                      required
                      aria-invalid={lineErrors[line.key] ? true : undefined}
                      aria-describedby={lineErrors[line.key] ? errorId : undefined}
                    />
                  </div>

                  <div className="sale-line__field sale-line__field--total">
                    <span className="sale-line__total-label">Total</span>
                    <span>{total === null ? '—' : formatCents(total, currency)}</span>
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

                  <div className="expense-line__metadata">
                    <div className="sale-line__field">
                      <label htmlFor={`${line.key}-type`}>Type</label>
                      <select
                        id={`${line.key}-type`}
                        value={line.type}
                        onChange={(event) =>
                          updateLine(line.key, { type: event.target.value as ExpenseLineType })
                        }
                      >
                        {EXPENSE_LINE_TYPES.map((type) => (
                          <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sale-line__field">
                      <label htmlFor={`${line.key}-category`}>Category</label>
                      <input
                        id={`${line.key}-category`}
                        value={line.category}
                        maxLength={60}
                        onChange={(event) => updateLine(line.key, { category: event.target.value })}
                      />
                    </div>
                    <div className="sale-line__field">
                      <label htmlFor={`${line.key}-subcategory`}>Sub-category</label>
                      <input
                        id={`${line.key}-subcategory`}
                        value={line.subcategory}
                        maxLength={60}
                        onChange={(event) => updateLine(line.key, { subcategory: event.target.value })}
                      />
                    </div>
                    <div className="sale-line__field">
                      <label htmlFor={`${line.key}-manufacturer`}>Manufacturer</label>
                      <input
                        id={`${line.key}-manufacturer`}
                        value={line.manufacturer}
                        maxLength={100}
                        onChange={(event) => updateLine(line.key, { manufacturer: event.target.value })}
                      />
                    </div>
                  </div>

                  {lineErrors[line.key] && (
                    <span id={errorId} className="field-error sale-line__error" aria-live="polite">
                      {lineErrors[line.key]}
                    </span>
                  )}
                </fieldset>
              );
            })}

          {!items && !itemsError && <p className="muted">Loading items…</p>}

          <button
            type="button"
            className="button button--secondary sale-lines__add"
            onClick={addLine}
          >
            Add another item <PlusIcon />
          </button>
        </div>

        <div className="sale-total">
          <span>Total</span>
          <span>{formatCents(grandTotalCents, currency)}</span>
        </div>

        <div className="form-row">
          <label htmlFor="expense-date">
            Date
            <span className="required-marker" aria-hidden="true">
              {' '}
              *
            </span>
          </label>
          <div className="form-row__control">
            <input
              id="expense-date"
              type="date"
              value={date}
              onChange={(event) => {
                setHasUnsavedInput(true);
                setDate(event.target.value);
                setDateError(null);
              }}
              required
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? 'expense-date-error' : undefined}
            />
            {dateError && (
              <span id="expense-date-error" className="field-error" aria-live="polite">
                {dateError}
              </span>
            )}
          </div>
        </div>

        <SelectWithAddRow
          id="expense-tag"
          label="Tag"
          required
          noun="tag"
          options={tagOptions?.map((name) => ({ value: name, label: name })) ?? null}
          loadError={tagsError}
          value={tag}
          onChange={(value) => {
            setHasUnsavedInput(true);
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

        <div className="form-row">
          <span className="form-row__label">ID</span>
          <span className="form-row__static">{expense?.id ?? 'Assigned on save'}</span>
        </div>

        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  );
}
