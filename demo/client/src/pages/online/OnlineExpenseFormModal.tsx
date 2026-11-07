import { useState, type FormEvent } from 'react';
import { ApiError, getErrorMessage } from '../../api/http';
import { FormRow } from '../../components/FormRow';
import { Modal } from '../../components/Modal';
import { SelectWithAddRow } from '../../components/SelectWithAddRow';
import { useCurrency } from '../../hooks/useCurrency';
import {
  CURRENCY_CODES,
  type CurrencyCode,
  type OnlineExpense,
  type OnlineExpenseInput,
} from '../../types';
import { centsToInputValue, MAX_AMOUNT_CENTS, parseDollarsToCents } from '../../utils/money';

interface OnlineExpenseFormModalProps {
  /** Pass an expense to edit it; omit to create one. */
  expense?: OnlineExpense;
  /** Date (YYYY-MM-DD) a new expense starts on. */
  defaultDate: string;
  /** Tags already used on other expenses, offered in the tag dropdown. */
  knownTags: string[];
  onCancel: () => void;
  onSubmit: (input: OnlineExpenseInput) => Promise<void>;
}

type Errors = Partial<Record<'spentOn' | 'amount' | 'tags', string>>;

export function OnlineExpenseFormModal({
  expense,
  defaultDate,
  knownTags,
  onCancel,
  onSubmit,
}: OnlineExpenseFormModalProps) {
  const businessCurrency = useCurrency();
  const isEditing = expense !== undefined;

  const [spentOn, setSpentOn] = useState(expense?.spentOn ?? defaultDate);
  const [description, setDescription] = useState(expense?.description ?? '');
  const [category, setCategory] = useState(expense?.category ?? '');
  const [amount, setAmount] = useState(expense ? centsToInputValue(expense.amountCents) : '');
  const [currency, setCurrency] = useState<CurrencyCode>(
    expense?.currency ?? (businessCurrency as CurrencyCode),
  );
  const [tags, setTags] = useState<string[]>(expense?.tags ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  function touch<T>(setter: (next: T) => void) {
    return (next: T) => {
      setDirty(true);
      setter(next);
    };
  }

  function handleCancel() {
    if (dirty && !window.confirm('You have unsaved information. Are you sure you want to discard it?')) {
      return;
    }
    onCancel();
  }

  const tagOptions = [...new Set([...knownTags, ...tags])]
    .filter((tag) => !tags.includes(tag))
    .map((tag) => ({ value: tag, label: tag }));

  function buildInput(): OnlineExpenseInput | null {
    const found: Errors = {};
    if (!spentOn) found.spentOn = 'Pick a date';
    const cents = parseDollarsToCents(amount);
    if (cents === null || cents < 0 || cents > MAX_AMOUNT_CENTS) {
      found.amount = 'Enter a number like 25 or 25.50';
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || cents === null) return null;
    return {
      spentOn,
      description: description.trim(),
      category: category.trim(),
      amountCents: cents,
      currency,
      tags,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input = buildInput();
    if (!input) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(input);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        const server: Errors = {};
        for (const { field, message } of error.fieldErrors) {
          if (field === 'spentOn') server.spentOn = message;
          else if (field === 'amountCents') server.amount = message;
        }
        setErrors(server);
      }
      setSubmitError(getErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Modify online expense' : 'Add online expense'}
      onClose={handleCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={handleCancel}>
            Cancel
          </button>
          <button type="submit" form="online-expense-form" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="online-expense-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <span className="form-row__label">ID</span>
          <span className="form-row__static">{expense?.id ?? 'Assigned on save'}</span>
        </div>

        <FormRow label="Date" htmlFor="online-expense-date" error={errors.spentOn} required>
          <input
            id="online-expense-date"
            type="date"
            value={spentOn}
            onChange={(event) => touch(setSpentOn)(event.target.value)}
          />
        </FormRow>
        <FormRow label="Description" htmlFor="online-expense-description">
          <input
            id="online-expense-description"
            value={description}
            maxLength={200}
            placeholder="e.g. Etsy listing fees"
            onChange={(event) => touch(setDescription)(event.target.value)}
          />
        </FormRow>
        <FormRow label="Category" htmlFor="online-expense-category">
          <input
            id="online-expense-category"
            value={category}
            maxLength={60}
            placeholder="e.g. Shipping"
            onChange={(event) => touch(setCategory)(event.target.value)}
          />
        </FormRow>
        <FormRow label="Currency" htmlFor="online-expense-currency">
          <select
            id="online-expense-currency"
            value={currency}
            onChange={(event) => touch(setCurrency)(event.target.value as CurrencyCode)}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label={`Amount (${currency})`} htmlFor="online-expense-amount" error={errors.amount} required>
          <input
            id="online-expense-amount"
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            onChange={(event) => touch(setAmount)(event.target.value)}
          />
        </FormRow>

        <SelectWithAddRow
          id="online-expense-tag"
          label="Tags"
          noun="tag"
          options={tagOptions}
          loadError={null}
          value=""
          onChange={(tag) => {
            if (!tag) return;
            setDirty(true);
            setTags((current) => (current.includes(tag) ? current : [...current, tag]));
          }}
          onAdd={async (tag) => tag}
          error={errors.tags ?? null}
          maxLength={30}
          placeholder="e.g. Platform"
        />
        {tags.length > 0 && (
          <div className="form-row">
            <span className="form-row__label" />
            <div className="form-row__control item-form__tags">
              {tags.map((tag) => (
                <span key={tag} className="item-form__tag">
                  {tag}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => {
                      setDirty(true);
                      setTags((current) => current.filter((entry) => entry !== tag));
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {submitError && (
          <div className="banner banner--error" role="alert">
            {submitError}
          </div>
        )}
      </form>
    </Modal>
  );
}
