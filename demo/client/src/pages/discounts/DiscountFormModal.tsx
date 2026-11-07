import { useState, type FormEvent } from 'react';
import { listDiscountAppliesTo } from '../../api/discounts';
import { ApiError, getErrorMessage } from '../../api/http';
import { FormRow } from '../../components/FormRow';
import { Modal } from '../../components/Modal';
import { useCurrency } from '../../hooks/useCurrency';
import { useLoad } from '../../hooks/useLoad';
import {
  CURRENCY_CODES,
  type CurrencyCode,
  type Discount,
  type DiscountInput,
  type DiscountKind,
  type DiscountValueType,
} from '../../types';
import { centsToInputValue, parseDollarsToCents } from '../../utils/money';

interface DiscountFormModalProps {
  /** Pass a discount to edit it; omit to create one. */
  discount?: Discount;
  onCancel: () => void;
  onSubmit: (input: DiscountInput) => Promise<void>;
}

const KIND_LABELS: Record<DiscountKind, string> = {
  PRESET: 'Preset (buy N, get M)',
  PER_AMOUNT: 'Per amount (price breaks)',
  SOLID: 'Solid amount',
};

interface TierRow {
  count: string;
  price: string;
}

type Errors = Partial<Record<'name' | 'value' | 'buyCount' | 'getCount' | 'tiers', string>>;

function parsePositiveInt(raw: string): number | null {
  const value = Number(raw);
  return raw.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= 1000 ? value : null;
}

export function DiscountFormModal({ discount, onCancel, onSubmit }: DiscountFormModalProps) {
  const businessCurrency = useCurrency();
  const appliesToOptions = useLoad(listDiscountAppliesTo);
  const isEditing = discount !== undefined;

  const [name, setName] = useState(discount?.name ?? '');
  const [appliesTo, setAppliesTo] = useState(discount?.appliesTo ?? '');
  const [kind, setKind] = useState<DiscountKind>(discount?.kind ?? 'SOLID');
  const [isCharge, setIsCharge] = useState(discount?.isCharge ?? false);
  const [currency, setCurrency] = useState<CurrencyCode>(
    discount?.currency ?? (businessCurrency as CurrencyCode),
  );
  const [valueType, setValueType] = useState<DiscountValueType>(discount?.valueType ?? 'PERCENT');
  const [value, setValue] = useState(discount?.value != null ? String(discount.value) : '');
  const [buyCount, setBuyCount] = useState(discount?.buyCount != null ? String(discount.buyCount) : '');
  const [getCount, setGetCount] = useState(discount?.getCount != null ? String(discount.getCount) : '');
  const [tiers, setTiers] = useState<TierRow[]>(
    discount && discount.tiers.length > 0
      ? discount.tiers.map((tier) => ({
          count: String(tier.count),
          price: centsToInputValue(tier.priceCents),
        }))
      : [{ count: '1', price: '' }],
  );
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

  function buildInput(): { input?: DiscountInput; errors: Errors } {
    const found: Errors = {};
    const trimmed = name.trim();
    if (!trimmed) found.name = 'Name is required';

    let parsedValue: number | null = null;
    let parsedBuy: number | null = null;
    let parsedGet: number | null = null;
    const parsedTiers: { count: number; priceCents: number }[] = [];

    if (kind === 'PRESET') {
      parsedBuy = parsePositiveInt(buyCount);
      parsedGet = parsePositiveInt(getCount);
      if (parsedBuy === null) found.buyCount = 'Enter a whole number, 1 or more';
      if (parsedGet === null) found.getCount = 'Enter a whole number, 1 or more';
    }
    if (kind === 'PRESET' || kind === 'SOLID') {
      const cents = parseDollarsToCents(value);
      if (cents === null || cents < 0) found.value = 'Enter a number like 10 or 2.50';
      else if (valueType === 'PERCENT' && cents > 10000) found.value = 'A percentage can’t be more than 100';
      else parsedValue = cents / 100;
    }
    if (kind === 'PER_AMOUNT') {
      const seen = new Set<number>();
      for (const row of tiers) {
        const count = parsePositiveInt(row.count);
        const cents = parseDollarsToCents(row.price);
        if (count === null || cents === null || cents < 0) {
          found.tiers = 'Each price break needs a count and a price';
          break;
        }
        if (seen.has(count)) {
          found.tiers = 'Each price break needs a different count';
          break;
        }
        seen.add(count);
        parsedTiers.push({ count, priceCents: cents });
      }
    }
    if (Object.keys(found).length > 0) return { errors: found };
    return {
      errors: found,
      input: {
        name: trimmed,
        appliesTo: appliesTo || null,
        kind,
        isCharge,
        valueType: kind === 'PER_AMOUNT' ? null : valueType,
        value: kind === 'PER_AMOUNT' ? null : parsedValue,
        buyCount: kind === 'PRESET' ? parsedBuy : null,
        getCount: kind === 'PRESET' ? parsedGet : null,
        tiers: parsedTiers,
        currency,
      },
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const { input, errors: found } = buildInput();
    setErrors(found);
    if (!input) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(input);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.length > 0) {
        const server: Errors = {};
        for (const { field, message } of error.fieldErrors) {
          const key = field.split('.')[0];
          if (key === 'name') server.name = message;
          else if (key === 'value') server.value = message;
          else if (key === 'buyCount') server.buyCount = message;
          else if (key === 'getCount') server.getCount = message;
          else if (key === 'tiers') server.tiers = message;
        }
        setErrors(server);
      }
      setSubmitError(getErrorMessage(error));
      setSubmitting(false);
    }
  }

  const valueLabel = valueType === 'PERCENT' ? 'Percentage' : `Amount (${currency})`;

  return (
    <Modal
      title={isEditing ? 'Modify discount or charge' : 'Add discount or charge'}
      onClose={handleCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={handleCancel}>
            Cancel
          </button>
          <button type="submit" form="discount-form" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="discount-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <span className="form-row__label">ID</span>
          <span className="form-row__static">{discount?.id ?? 'Assigned on save'}</span>
        </div>

        <FormRow label="Name" htmlFor="discount-name" error={errors.name} required>
          <input
            id="discount-name"
            value={name}
            maxLength={80}
            placeholder="Buy 2 get 1 free"
            onChange={(event) => touch(setName)(event.target.value)}
          />
        </FormRow>

        <FormRow label="Type" htmlFor="discount-isCharge">
          <select
            id="discount-isCharge"
            value={isCharge ? 'charge' : 'discount'}
            onChange={(event) => touch(setIsCharge)(event.target.value === 'charge')}
          >
            <option value="discount">Discount (takes money off)</option>
            <option value="charge">Charge (adds money)</option>
          </select>
        </FormRow>

        <FormRow label="Applicable to" htmlFor="discount-appliesTo">
          <select
            id="discount-appliesTo"
            value={appliesTo}
            onChange={(event) => touch(setAppliesTo)(event.target.value)}
          >
            <option value="">All items</option>
            {[...new Set([...(appliesToOptions.data ?? []), ...(appliesTo ? [appliesTo] : [])])].map(
              (tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ),
            )}
          </select>
        </FormRow>

        <FormRow label="Kind" htmlFor="discount-kind">
          <select
            id="discount-kind"
            value={kind}
            onChange={(event) => touch(setKind)(event.target.value as DiscountKind)}
          >
            {(Object.keys(KIND_LABELS) as DiscountKind[]).map((option) => (
              <option key={option} value={option}>
                {KIND_LABELS[option]}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow label="Currency" htmlFor="discount-currency">
          <select
            id="discount-currency"
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

        {kind === 'PRESET' && (
          <>
            <FormRow label="Buy" htmlFor="discount-buy" error={errors.buyCount} required>
              <input
                id="discount-buy"
                inputMode="numeric"
                value={buyCount}
                placeholder="2"
                onChange={(event) => touch(setBuyCount)(event.target.value)}
              />
            </FormRow>
            <FormRow label="Get" htmlFor="discount-get" error={errors.getCount} required>
              <input
                id="discount-get"
                inputMode="numeric"
                value={getCount}
                placeholder="1"
                onChange={(event) => touch(setGetCount)(event.target.value)}
              />
            </FormRow>
          </>
        )}

        {kind !== 'PER_AMOUNT' && (
          <>
            <FormRow
              label={kind === 'PRESET' ? 'The extra items are' : 'Value type'}
              htmlFor="discount-valueType"
            >
              <select
                id="discount-valueType"
                value={valueType}
                onChange={(event) => touch(setValueType)(event.target.value as DiscountValueType)}
              >
                <option value="PERCENT">Percentage</option>
                <option value="AMOUNT">Amount</option>
              </select>
            </FormRow>
            <FormRow label={valueLabel} htmlFor="discount-value" error={errors.value} required>
              <input
                id="discount-value"
                inputMode="decimal"
                value={value}
                placeholder={valueType === 'PERCENT' ? '10' : '2.50'}
                onChange={(event) => touch(setValue)(event.target.value)}
              />
            </FormRow>
          </>
        )}

        {kind === 'PER_AMOUNT' && (
          <div className="form-row">
            <span className="form-row__label">Price breaks</span>
            <div className="form-row__control">
              {tiers.map((row, index) => (
                <div key={index} className="item-form__size">
                  <input
                    aria-label={`Break ${index + 1} count`}
                    inputMode="numeric"
                    placeholder="Count"
                    value={row.count}
                    onChange={(event) =>
                      touch(setTiers)(
                        tiers.map((entry, i) =>
                          i === index ? { ...entry, count: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                  <span aria-hidden="true">for</span>
                  <input
                    aria-label={`Break ${index + 1} price (${currency})`}
                    inputMode="decimal"
                    placeholder={`Price (${currency})`}
                    value={row.price}
                    onChange={(event) =>
                      touch(setTiers)(
                        tiers.map((entry, i) =>
                          i === index ? { ...entry, price: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove break ${index + 1}`}
                      onClick={() => touch(setTiers)(tiers.filter((_, i) => i !== index))}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="link-button"
                onClick={() => touch(setTiers)([...tiers, { count: '', price: '' }])}
              >
                + Add price break
              </button>
              {errors.tiers && (
                <span className="field-error" aria-live="polite">
                  {errors.tiers}
                </span>
              )}
            </div>
          </div>
        )}

        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  );
}
