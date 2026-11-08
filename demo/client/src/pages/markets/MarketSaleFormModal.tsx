import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listChannels } from '../../api/channels';
import { listDiscounts } from '../../api/discounts';
import { getErrorMessage } from '../../api/http';
import { listItems } from '../../api/items';
import { FormRow } from '../../components/FormRow';
import { Modal } from '../../components/Modal';
import { PlusIcon, TrashIcon } from '../../components/icons';
import {
  CURRENCY_CODES,
  type CurrencyCode,
  type Discount,
  type Item,
  type Sale,
  type SaleInput,
} from '../../types';
import { dateInputValueToIso, isoToDateInputValue } from '../../utils/date';
import { centsToInputValue, MAX_AMOUNT_CENTS, parseDollarsToCents } from '../../utils/money';

/** The target that determines where this itemized sale is recorded. */
export interface SaleTarget {
  marketId: number | null;
  commissionId: number | null;
  miscId: number | null;
  /** The channel the sale is put on, matched by name ignoring case. */
  channelName: string;
  title: string;
  currency: CurrencyCode;
  defaultDate: string;
}

interface MarketSaleFormModalProps {
  target: SaleTarget;
  /** Pass a sale to edit it; omit to record one. */
  sale?: Sale;
  onCancel: () => void;
  onSubmit: (input: SaleInput) => Promise<void>;
}

interface LineState {
  key: string;
  itemId: string;
  quantity: string;
  price: string;
  isFree: boolean;
  isTrade: boolean;
}

let nextKey = 0;
function newLine(partial: Partial<LineState> = {}): LineState {
  nextKey += 1;
  return {
    key: `market-line-${nextKey}`,
    itemId: '',
    quantity: '1',
    price: '',
    isFree: false,
    isTrade: false,
    ...partial,
  };
}

function linesFromSale(sale?: Sale): LineState[] {
  const itemLines = (sale?.items ?? []).filter((line) => line.kind === 'ITEM');
  if (itemLines.length === 0) return [newLine()];
  return itemLines.map((line) =>
    newLine({
      itemId: line.itemId === null ? '' : String(line.itemId),
      quantity: String(line.quantity),
      isFree: line.isFree,
      isTrade: line.isTrade,
    }),
  );
}

export function MarketSaleFormModal({ target, sale, onCancel, onSubmit }: MarketSaleFormModalProps) {
  const isEditing = sale !== undefined;
  const [items, setItems] = useState<Item[] | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [inPersonChannelId, setInPersonChannelId] = useState<number | null>(sale?.channel?.id ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [date, setDate] = useState(() =>
    sale ? isoToDateInputValue(sale.soldAt) : target.defaultDate,
  );
  const [currency, setCurrency] = useState<CurrencyCode>(
    (sale?.originalCurrency as CurrencyCode | undefined) ?? target.currency,
  );
  const [lines, setLines] = useState<LineState[]>(() => linesFromSale(sale));
  const [discountIds, setDiscountIds] = useState<Set<number>>(
    () =>
      new Set(
        (sale?.items ?? []).flatMap((line) => (line.discountId === null ? [] : [line.discountId])),
      ),
  );
  const [tip, setTip] = useState(() => {
    const tipLine = sale?.items.find((line) => line.kind === 'TIP');
    return tipLine ? centsToInputValue(tipLine.totalCents) : '';
  });
  const [dateError, setDateError] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    listItems({ page: 1, pageSize: 100 })
      .then((page) => setItems(page.data))
      .catch((error: unknown) => setLoadError(getErrorMessage(error)));
    listDiscounts()
      .then(setDiscounts)
      .catch((error: unknown) => setLoadError(getErrorMessage(error)));
    if (sale?.channel) return;
    listChannels()
      .then((channels) => {
        const found = channels.find(
          (channel) => channel.name.toLowerCase() === target.channelName.toLowerCase(),
        );
        setInPersonChannelId((found ?? channels[0])?.id ?? null);
      })
      .catch((error: unknown) => setLoadError(getErrorMessage(error)));
  }, [sale, target.channelName]);

  const itemById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items]);
  const selectableItems = (items ?? []).filter(
    (item) => item.isActive || lines.some((line) => line.itemId === String(item.id)),
  );

  function updateLine(key: string, changes: Partial<LineState>) {
    setDirty(true);
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));
    setLineErrors((current) => ({ ...current, [key]: '' }));
  }

  function handleCancel() {
    if (dirty && !window.confirm('You have unsaved information. Are you sure you want to discard it?')) {
      return;
    }
    onCancel();
  }

  function validate(): SaleInput | null {
    const soldAt = dateInputValueToIso(date);
    setDateError(soldAt ? null : 'Pick a date');

    let tipCents: number | null = null;
    if (tip.trim() !== '') {
      const cents = parseDollarsToCents(tip);
      if (cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS) {
        setTipError('Enter a number like 2 or 2.50');
        return null;
      }
      tipCents = cents;
    }
    setTipError(null);

    const errors: Record<string, string> = {};
    const parsed: SaleInput['items'] = lines.map((line) => {
      const itemId = Number(line.itemId);
      const quantity = Number(line.quantity);
      let unitPriceCents: number | null = null;
      if (!line.itemId || !itemById.has(itemId)) errors[line.key] = 'Pick an item';
      else if (!Number.isInteger(quantity) || quantity <= 0)
        errors[line.key] = 'Enter a whole number, 1 or more';
      else if (line.price.trim() !== '' && !line.isFree && !line.isTrade) {
        const cents = parseDollarsToCents(line.price);
        if (cents === null || cents < 0 || cents > MAX_AMOUNT_CENTS)
          errors[line.key] = 'Enter a price like 12 or 12.50';
        else unitPriceCents = cents;
      }
      return { itemId, quantity, unitPriceCents, isFree: line.isFree, isTrade: line.isTrade };
    });
    setLineErrors(errors);
    if (!soldAt || Object.keys(errors).length > 0 || inPersonChannelId === null) return null;
    return {
      soldAt,
      channelId: inPersonChannelId,
      description: '',
      tags: sale?.tags ?? [],
      items: parsed,
      marketId: target.marketId,
      commissionId: target.commissionId,
      miscId: target.miscId,
      currency,
      tipCents,
      discountIds: [...discountIds],
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
      title={isEditing ? 'Modify sale' : target.title}
      onClose={handleCancel}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="submit"
            form="market-sale-form"
            className="button"
            disabled={submitting || !items || inPersonChannelId === null}
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="market-sale-form" className="item-form" onSubmit={handleSubmit} noValidate>
        {loadError && (
          <div className="banner banner--error" role="alert">
            {loadError}
          </div>
        )}
        {isEditing && (
          <div className="form-row">
            <span className="form-row__label">ID</span>
            <span className="form-row__static">{sale.id}</span>
          </div>
        )}

        <FormRow label="Date" htmlFor="market-sale-date" error={dateError ?? undefined} required>
          <input
            id="market-sale-date"
            type="date"
            value={date}
            onChange={(event) => {
              setDirty(true);
              setDate(event.target.value);
            }}
          />
        </FormRow>

        <FormRow label="Currency" htmlFor="market-sale-currency">
          <select
            id="market-sale-currency"
            value={currency}
            onChange={(event) => {
              setDirty(true);
              setCurrency(event.target.value as CurrencyCode);
            }}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </FormRow>

        {lines.map((line, index) => {
          const item = itemById.get(Number(line.itemId));
          const adjusted = line.isFree || line.isTrade;
          return (
            <FormRow
              key={line.key}
              label={`Item ${index + 1}`}
              htmlFor={`market-sale-item-${index}`}
              error={lineErrors[line.key] || undefined}
              required
            >
              <div className="item-form__size">
                <select
                  id={`market-sale-item-${index}`}
                  value={line.itemId}
                  onChange={(event) => updateLine(line.key, { itemId: event.target.value })}
                >
                  <option value="">Pick an item</option>
                  {selectableItems.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.quantity} in stock)
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Item ${index + 1} quantity`}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove item ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => {
                    setDirty(true);
                    setLines((current) => current.filter((entry) => entry.key !== line.key));
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
              <div className="item-form__size">
                <input
                  aria-label={`Item ${index + 1} change price`}
                  inputMode="decimal"
                  disabled={adjusted}
                  value={adjusted ? '' : line.price}
                  placeholder={
                    item && !adjusted
                      ? `Change price (now ${centsToInputValue(item.unitPriceCents)} ${item.currency})`
                      : 'Change price'
                  }
                  onChange={(event) => updateLine(line.key, { price: event.target.value })}
                />
                <label className="item-form__check">
                  <input
                    type="checkbox"
                    checked={line.isFree}
                    onChange={(event) =>
                      updateLine(line.key, { isFree: event.target.checked, isTrade: false })
                    }
                  />
                  Free?
                </label>
                <label className="item-form__check">
                  <input
                    type="checkbox"
                    checked={line.isTrade}
                    onChange={(event) =>
                      updateLine(line.key, { isTrade: event.target.checked, isFree: false })
                    }
                  />
                  Trade?
                </label>
              </div>
            </FormRow>
          );
        })}
        <div className="form-row">
          <span className="form-row__label" />
          <div className="form-row__control">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setDirty(true);
                setLines((current) => [...current, newLine()]);
              }}
            >
              Add item <PlusIcon />
            </button>
          </div>
        </div>

        <FormRow
          label="Discounts & charges"
          htmlFor="market-sale-discounts"
          hint="Calculated when you save"
        >
          <div id="market-sale-discounts">
            {discounts.length === 0 && <span className="muted">None in your library yet</span>}
            {discounts.map((discount) => (
              <label key={discount.id} className="item-form__check">
                <input
                  type="checkbox"
                  checked={discountIds.has(discount.id)}
                  onChange={(event) => {
                    setDirty(true);
                    setDiscountIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(discount.id);
                      else next.delete(discount.id);
                      return next;
                    });
                  }}
                />
                {discount.name}
                {discount.isCharge ? ' (charge)' : ''}
              </label>
            ))}
          </div>
        </FormRow>

        <FormRow label={`Tip (${currency})`} htmlFor="market-sale-tip" error={tipError ?? undefined}>
          <input
            id="market-sale-tip"
            inputMode="decimal"
            value={tip}
            placeholder="0.00"
            onChange={(event) => {
              setDirty(true);
              setTip(event.target.value);
            }}
          />
        </FormRow>

        {submitError && (
          <div className="banner banner--error" role="alert">
            {submitError}
          </div>
        )}
      </form>
    </Modal>
  );
}
