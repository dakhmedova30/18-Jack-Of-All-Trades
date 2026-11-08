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
import { centsToInputValue, formatCents, MAX_AMOUNT_CENTS, parseDollarsToCents } from '../../utils/money';

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
  itemName: string;
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
    itemName: '',
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
      itemId: line.itemId === null ? 'custom' : String(line.itemId),
      itemName: line.itemName,
      quantity: String(line.quantity),
      price: line.itemId === null ? centsToInputValue(line.unitPriceCents) : '',
      isFree: line.isFree,
      isTrade: line.isTrade,
    }),
  );
}

function estimateDiscount(discount: Discount, prices: number[]): number {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => b - a);
  const subtotal = sorted.reduce((sum, price) => sum + price, 0);
  const each = (price: number) =>
    discount.valueType === 'PERCENT' && discount.value !== null
      ? Math.round((price * discount.value) / 100)
      : Math.min(Math.round((discount.value ?? 0) * 100), price);
  let amount = 0;
  if (discount.kind === 'SOLID') {
    amount = each(subtotal);
  } else if (discount.kind === 'PRESET') {
    const group = (discount.buyCount ?? 0) + (discount.getCount ?? 0);
    if (group > 0) {
      for (let start = 0; start + group <= sorted.length; start += group) {
        for (let index = start + (discount.buyCount ?? 0); index < start + group; index++) {
          amount += each(sorted[index]);
        }
      }
    }
  } else {
    const tiers = [...discount.tiers].sort((a, b) => a.count - b.count);
    let index = 0;
    while (index < sorted.length) {
      const tier = tiers.filter((entry) => entry.count <= sorted.length - index).at(-1);
      if (!tier) break;
      const regular = sorted.slice(index, index + tier.count).reduce((sum, price) => sum + price, 0);
      amount += Math.max(0, regular - tier.priceCents);
      index += tier.count;
    }
  }
  return Math.max(0, Math.min(amount, subtotal));
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
  const linePrices = lines.flatMap((line) => {
    if (line.isFree || line.isTrade) return [];
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return [];
    const item = itemById.get(Number(line.itemId));
    const parsedPrice = line.price.trim() ? parseDollarsToCents(line.price) : null;
    const unitPrice = line.price.trim()
      ? parsedPrice
      : line.itemId === 'custom'
        ? null
        : item?.unitPriceCents;
    if (unitPrice === null || unitPrice === undefined || unitPrice < 0) return [];
    return Array.from({ length: Math.min(quantity, 1000) }, () => ({
      price: unitPrice,
      tags: item?.tags ?? [],
    }));
  });
  const discountEstimate = [...discountIds].reduce((total, discountId) => {
    const discount = discounts.find((entry) => entry.id === discountId);
    if (!discount) return total;
    const eligible = linePrices
      .filter((line) => discount.appliesTo === null || line.tags.includes(discount.appliesTo))
      .map((line) => line.price);
    const amount = estimateDiscount(discount, eligible);
    return total + (discount.isCharge ? amount : -amount);
  }, 0);
  const parsedTip = tip.trim() ? parseDollarsToCents(tip) ?? 0 : 0;
  const estimatedGross = lines.reduce((sum, line) => {
    if (line.isFree || line.isTrade) return sum;
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return sum;
    const item = itemById.get(Number(line.itemId));
    const unitPrice = line.price.trim()
      ? parseDollarsToCents(line.price)
      : line.itemId === 'custom'
        ? null
        : item?.unitPriceCents;
    return unitPrice === null || unitPrice === undefined || unitPrice < 0
      ? sum
      : sum + unitPrice * quantity;
  }, 0);
  const totalEstimate = estimatedGross + discountEstimate + parsedTip;
  const needsCurrencyEstimate =
    lines.some((line) => {
      const item = itemById.get(Number(line.itemId));
      return item !== undefined && item.currency !== currency && !line.price.trim();
    }) ||
    [...discountIds].some((id) => {
      const discount = discounts.find((entry) => entry.id === id);
      return discount !== undefined && discount.currency !== currency;
    });
  const hasLargeQuantity = lines.some((line) => Number(line.quantity) > 1000);

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
      const customItem = line.itemId === 'custom';
      const itemId = customItem ? null : Number(line.itemId);
      const quantity = Number(line.quantity);
      let unitPriceCents: number | null = null;
      if (customItem && target.miscId === null) errors[line.key] = 'One-time items are only available in Miscellaneous';
      else if (customItem && !line.itemName.trim()) errors[line.key] = 'Enter a name for the one-time item';
      else if (!customItem && (!line.itemId || !itemById.has(Number(line.itemId)))) errors[line.key] = 'Pick an item';
      else if (!Number.isInteger(quantity) || quantity <= 0)
        errors[line.key] = 'Enter a whole number, 1 or more';
      else if (line.price.trim() !== '' && !line.isFree && !line.isTrade) {
        const cents = parseDollarsToCents(line.price);
        if (cents === null || cents < 0 || cents > MAX_AMOUNT_CENTS)
          errors[line.key] = 'Enter a price like 12 or 12.50';
        else unitPriceCents = cents;
      }
      if (customItem && !line.isFree && !line.isTrade && line.price.trim() === '')
        errors[line.key] = 'Enter a price for the one-time item';
      return {
        itemId,
        itemName: customItem ? line.itemName.trim() : undefined,
        quantity,
        unitPriceCents,
        isFree: line.isFree,
        isTrade: line.isTrade,
      };
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
              <div className="item-form__size sale-item-row">
                <select
                  id={`market-sale-item-${index}`}
                  value={line.itemId}
                  onChange={(event) => updateLine(line.key, { itemId: event.target.value, itemName: '', price: '' })}
                >
                  <option value="">Pick an item</option>
                  {selectableItems.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} ({entry.quantity} in stock)
                    </option>
                  ))}
                  {target.miscId !== null && <option value="custom">One-time item</option>}
                </select>
                {line.itemId === 'custom' && (
                  <input
                    aria-label={`Item ${index + 1} name`}
                    value={line.itemName}
                    maxLength={200}
                    placeholder="One-time item name"
                    onChange={(event) => updateLine(line.key, { itemName: event.target.value })}
                  />
                )}
                <input
                  aria-label={`Item ${index + 1} quantity`}
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                />
              </div>
              <div className="item-form__size sale-item-row">
                <input
                  aria-label={`Item ${index + 1} change price`}
                  inputMode="decimal"
                  disabled={adjusted}
                  value={adjusted ? '' : line.price}
                  placeholder={
                    line.itemId === 'custom' && !adjusted
                      ? `Price (${currency})`
                      : item && !adjusted
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
          label="Discounts & Charges"
          htmlFor="market-sale-discounts"
          hint="The estimate below updates with your selections; saved totals use server currency conversion."
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

        <div className="sale-total-preview" aria-live="polite">
          <strong>Estimated sale total:</strong>{' '}
          <strong>{formatCents(totalEstimate, currency)}</strong>
          {needsCurrencyEstimate && (
            <span className="muted"> Currency conversion may change this estimate.</span>
          )}
          {hasLargeQuantity && (
            <span className="muted"> Discount estimate is limited for quantities over 1,000 per line.</span>
          )}
        </div>

        {submitError && (
          <div className="banner banner--error" role="alert">
            {submitError}
          </div>
        )}
      </form>
    </Modal>
  );
}
