import { useState, type FormEvent } from 'react';
import { ApiError, getErrorMessage } from '../../api/http';
import { FormRow } from '../../components/FormRow';
import { Modal } from '../../components/Modal';
import { SelectWithAddRow } from '../../components/SelectWithAddRow';
import { useCurrency } from '../../hooks/useCurrency';
import {
  CURRENCY_CODES,
  MARKET_GOING,
  MARKET_STATUSES,
  type CurrencyCode,
  type Market,
  type MarketGoing,
  type MarketInput,
  type MarketStatus,
} from '../../types';
import { centsToInputValue, MAX_AMOUNT_CENTS, parseDollarsToCents } from '../../utils/money';

interface MarketFormModalProps {
  /** Pass a market to edit it; omit to create one. */
  market?: Market;
  /** Tags already used on other markets, offered in the tag dropdown. */
  knownTags: string[];
  onCancel: () => void;
  onSubmit: (input: MarketInput) => Promise<void>;
}

type Errors = Partial<Record<'name' | 'startDate' | 'endDate' | 'tableFee' | 'extra' | 'tags', string>>;

const STATUS_LABELS: Record<MarketStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  WAITLISTED: 'Waitlisted',
  REJECTED: 'Rejected',
};

const GOING_LABELS: Record<MarketGoing, string> = { PENDING: 'Pending', YES: 'Yes', NO: 'No' };

function parseMoney(raw: string): number | null {
  const cents = parseDollarsToCents(raw);
  return cents !== null && cents >= 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

export function MarketFormModal({ market, knownTags, onCancel, onSubmit }: MarketFormModalProps) {
  const businessCurrency = useCurrency();
  const isEditing = market !== undefined;

  const [name, setName] = useState(market?.name ?? '');
  const [startDate, setStartDate] = useState(market?.startDate ?? '');
  const [endDate, setEndDate] = useState(market?.endDate ?? '');
  const [location, setLocation] = useState(market?.location ?? '');
  const [tableFee, setTableFee] = useState(market ? centsToInputValue(market.tableFeeCents) : '');
  const [extra, setExtra] = useState(market ? centsToInputValue(market.extraExpensesCents) : '');
  const [currency, setCurrency] = useState<CurrencyCode>(
    market?.currency ?? (businessCurrency as CurrencyCode),
  );
  const [website, setWebsite] = useState(market?.website ?? '');
  const [status, setStatus] = useState<MarketStatus>(market?.status ?? 'PENDING');
  const [going, setGoing] = useState<MarketGoing>(market?.going ?? 'PENDING');
  const [tags, setTags] = useState<string[]>(market?.tags ?? []);
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

  function buildInput(): MarketInput | null {
    const found: Errors = {};
    const trimmed = name.trim();
    if (!trimmed) found.name = 'Name is required';
    if (!startDate) found.startDate = 'Pick a start date';
    if (!endDate) found.endDate = 'Pick an end date';
    else if (startDate && endDate < startDate) found.endDate = 'The end can’t be before the start';
    const feeCents = parseMoney(tableFee.trim() === '' ? '0' : tableFee);
    const extraCents = parseMoney(extra.trim() === '' ? '0' : extra);
    if (feeCents === null) found.tableFee = 'Enter a number like 25 or 25.50';
    if (extraCents === null) found.extra = 'Enter a number like 25 or 25.50';
    if (tags.length > 10) found.tags = 'At most 10 tags';
    setErrors(found);
    if (Object.keys(found).length > 0 || feeCents === null || extraCents === null) return null;
    return {
      name: trimmed,
      startDate,
      endDate,
      location: location.trim(),
      tableFeeCents: feeCents,
      extraExpensesCents: extraCents,
      currency,
      website: website.trim() || null,
      status,
      going,
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
          if (field === 'name') server.name = message;
          else if (field === 'startDate') server.startDate = message;
          else if (field === 'endDate') server.endDate = message;
          else if (field === 'tableFeeCents') server.tableFee = message;
          else if (field === 'extraExpensesCents') server.extra = message;
        }
        setErrors(server);
      }
      setSubmitError(getErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={isEditing ? 'Modify market' : 'Add market'}
      onClose={handleCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={handleCancel}>
            Cancel
          </button>
          <button type="submit" form="market-form" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="market-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <span className="form-row__label">ID</span>
          <span className="form-row__static">{market?.id ?? 'Assigned on save'}</span>
        </div>

        <FormRow label="Name" htmlFor="market-name" error={errors.name} required>
          <input
            id="market-name"
            value={name}
            maxLength={120}
            onChange={(event) => touch(setName)(event.target.value)}
          />
        </FormRow>
        <FormRow label="Start date" htmlFor="market-start" error={errors.startDate} required>
          <input
            id="market-start"
            type="date"
            value={startDate}
            onChange={(event) => touch(setStartDate)(event.target.value)}
          />
        </FormRow>
        <FormRow label="End date" htmlFor="market-end" error={errors.endDate} required>
          <input
            id="market-end"
            type="date"
            value={endDate}
            onChange={(event) => touch(setEndDate)(event.target.value)}
          />
        </FormRow>
        <FormRow label="Location" htmlFor="market-location">
          <input
            id="market-location"
            value={location}
            maxLength={200}
            onChange={(event) => touch(setLocation)(event.target.value)}
          />
        </FormRow>
        <FormRow label="Currency" htmlFor="market-currency">
          <select
            id="market-currency"
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
        <FormRow label={`Table fee (${currency})`} htmlFor="market-fee" error={errors.tableFee}>
          <input
            id="market-fee"
            inputMode="decimal"
            value={tableFee}
            placeholder="0.00"
            onChange={(event) => touch(setTableFee)(event.target.value)}
          />
        </FormRow>
        <FormRow label={`Extra expenses (${currency})`} htmlFor="market-extra" error={errors.extra}>
          <input
            id="market-extra"
            inputMode="decimal"
            value={extra}
            placeholder="0.00"
            onChange={(event) => touch(setExtra)(event.target.value)}
          />
        </FormRow>
        <FormRow label="Website" htmlFor="market-website">
          <input
            id="market-website"
            value={website}
            maxLength={300}
            placeholder="https://"
            onChange={(event) => touch(setWebsite)(event.target.value)}
          />
        </FormRow>
        <FormRow label="Status" htmlFor="market-status">
          <select
            id="market-status"
            value={status}
            onChange={(event) => touch(setStatus)(event.target.value as MarketStatus)}
          >
            {MARKET_STATUSES.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </FormRow>
        <FormRow label="Going" htmlFor="market-going">
          <select
            id="market-going"
            value={going}
            onChange={(event) => touch(setGoing)(event.target.value as MarketGoing)}
          >
            {MARKET_GOING.map((option) => (
              <option key={option} value={option}>
                {GOING_LABELS[option]}
              </option>
            ))}
          </select>
        </FormRow>

        <SelectWithAddRow
          id="market-tag"
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
          placeholder="e.g. Craft fair"
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
