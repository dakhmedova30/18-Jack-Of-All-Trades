import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/http';
import { listItems } from '../../api/items';
import { listAdjustments } from '../../api/adjustments';
import { getCurrencyRates } from '../../api/currencies';
import { Modal } from '../../components/Modal';
import type { Adjustment, CurrencyRates, Item, Market, MarketAdjustment, MarketSale, MarketSaleInput } from '../../types';
import { centsToInputValue, formatCents, MAX_AMOUNT_CENTS, parseDollarsToCents } from '../../utils/money';

type LineState = {
  key: string;
  itemId: string;
  quantity: string;
  price: string;
  free: boolean;
  trade: boolean;
};

type AdjustmentState = {
  key: string;
  kind: MarketAdjustment['kind'];
  type: MarketAdjustment['type'];
  merchType: string;
  valueMode: MarketAdjustment['valueMode'];
  value: string;
  buyCount: string;
  getCount: string;
  tiers: { key: string; quantity: string; price: string }[];
};

let keyCounter = 0;
function key() {
  keyCounter += 1;
  return `market-line-${keyCounter}`;
}

function localDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function newLine(): LineState {
  return { key: key(), itemId: '', quantity: '1', price: '', free: false, trade: false };
}

function newAdjustment(): AdjustmentState {
  return {
    key: key(),
    kind: 'DISCOUNT',
    type: 'SOLID_AMOUNT',
    merchType: '',
    valueMode: 'AMOUNT',
    value: '',
    buyCount: '2',
    getCount: '1',
    tiers: [{ key: key(), quantity: '1', price: '' }],
  };
}

function adjustmentsFromSale(sale?: MarketSale): AdjustmentState[] {
  return sale?.adjustments.map((adjustment) => ({
    key: key(),
    kind: adjustment.kind,
    type: adjustment.type,
    merchType: adjustment.merchType,
    valueMode: adjustment.valueMode,
    value: adjustment.valueMode === 'AMOUNT'
      ? centsToInputValue(adjustment.value)
      : (adjustment.value / 100).toFixed(2),
    buyCount: adjustment.buyCount === null ? '' : String(adjustment.buyCount),
    getCount: adjustment.getCount === null ? '' : String(adjustment.getCount),
    tiers: adjustment.tiers.length
      ? adjustment.tiers.map((tier) => ({
          key: key(),
          quantity: String(tier.quantity),
          price: centsToInputValue(tier.priceCents),
        }))
      : [{ key: key(), quantity: '1', price: '' }],
  })) ?? [];
}

interface MarketSaleModalProps {
  market: Market;
  sale?: MarketSale;
  initialTipOnly?: boolean;
  onCancel: () => void;
  onSubmit: (input: MarketSaleInput) => Promise<void>;
}

export function MarketSaleModal({ market, sale, initialTipOnly = false, onCancel, onSubmit }: MarketSaleModalProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRates | null>(null);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(sale?.currency ?? market.currency);
  const [catalogAdjustments, setCatalogAdjustments] = useState<Adjustment[] | null>(null);
  const [catalogAdjustmentsError, setCatalogAdjustmentsError] = useState<string | null>(null);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const [date, setDate] = useState(() => localDateTime(sale?.soldAt));
  const [tip, setTip] = useState(() => centsToInputValue(sale?.tipCents ?? 0));
  const [tipOnly, setTipOnly] = useState(() => initialTipOnly || (!!sale && sale.items.length === 0));
  const [adjustmentIds, setAdjustmentIds] = useState<number[]>(
    () => sale?.appliedAdjustments?.flatMap((adjustment) => adjustment.id === null ? [] : [adjustment.id]) ?? [],
  );
  const [lines, setLines] = useState<LineState[]>(() =>
    sale?.items.length
      ? sale.items.map((line) => ({
          key: key(),
          itemId: line.itemId === null ? '' : String(line.itemId),
          quantity: String(line.quantity),
          price: centsToInputValue(line.unitPriceCents),
          free: line.free,
          trade: line.trade,
        }))
      : [newLine()],
  );
  const [adjustments, setAdjustments] = useState<AdjustmentState[]>(() => adjustmentsFromSale(sale));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listItems({ page: 1, pageSize: 100, activeOnly: !sale })
      .then((response) => setItems(response.data))
      .catch((reason: unknown) => setItemsError(getErrorMessage(reason)));
    getCurrencyRates()
      .then(setCurrencyRates)
      .catch((reason: unknown) => setCurrencyError(getErrorMessage(reason)));
    listAdjustments()
      .then(setCatalogAdjustments)
      .catch((reason: unknown) => setCatalogAdjustmentsError(getErrorMessage(reason)));
  }, [sale]);

  const merchTypes = [...new Set(items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b));

  function defaultMarketPrice(item?: Item) {
    if (!item) return 'Inventory price';
    const itemRate = currencyRates?.cadPerUnit[item.currency];
    const marketRate = currencyRates?.cadPerUnit[currency];
    if (itemRate === undefined || marketRate === undefined) return `Rate unavailable (${item.currency})`;
    return centsToInputValue(Math.round(item.unitPriceCents * itemRate / marketRate));
  }

  function updateLine(lineKey: string, changes: Partial<LineState>) {
    setLines((current) => current.map((line) => (line.key === lineKey ? { ...line, ...changes } : line)));
  }

  function updateAdjustment(adjustmentKey: string, changes: Partial<AdjustmentState>) {
    setAdjustments((current) =>
      current.map((adjustment) =>
        adjustment.key === adjustmentKey ? { ...adjustment, ...changes } : adjustment,
      ),
    );
  }

  function toggleCatalogAdjustment(id: number) {
    setAdjustmentIds((current) => current.includes(id)
      ? current.filter((selected) => selected !== id)
      : [...current, id]);
  }

  function submitInput(): MarketSaleInput | null {
    const soldAt = new Date(date);
    if (!Number.isFinite(soldAt.getTime())) return setError('Choose a valid sale date and time.'), null;
    if (!currencyRates?.cadPerUnit[currency])
      return setError(`No exchange rate is available for ${currency}.`), null;
    const tipCents = parseDollarsToCents(tip);
    if (tipCents === null || tipCents < 0 || tipCents > MAX_AMOUNT_CENTS)
      return setError('Enter a valid tip amount.'), null;
    if (tipOnly && tipCents === 0) return setError('Enter a tip amount greater than zero.'), null;

    const parsedLines: MarketSaleInput['items'] = [];
    if (!tipOnly) {
      for (const line of lines) {
        if (!line.itemId.trim() && tipCents > 0) continue;
        const itemId = Number(line.itemId);
        const item = itemById.get(itemId);
        const quantity = Number(line.quantity);
        if (!item || (sale === undefined && !item.active)) return setError('Choose an active inventory item.'), null;
        if (!Number.isInteger(quantity) || quantity <= 0) return setError('Enter a whole quantity of 1 or more.'), null;
        if (line.free && line.trade) return setError('An item cannot be both free and a trade.'), null;
        const parsedPrice = line.price.trim() ? parseDollarsToCents(line.price) : null;
        if (line.price.trim() && (parsedPrice === null || parsedPrice < 0 || parsedPrice > MAX_AMOUNT_CENTS))
          return setError('Enter a valid item price.'), null;
        parsedLines.push({
          itemId,
          quantity,
          unitPriceCents: line.free || line.trade ? null : parsedPrice,
          free: line.free,
          trade: line.trade,
        });
      }
    }

    const parsedAdjustments: MarketAdjustment[] = [];
    for (const adjustment of tipOnly ? [] : adjustments) {
      const parsedValue = adjustment.type === 'PER_AMOUNT' && !adjustment.value.trim()
        ? 0
        : parseDollarsToCents(adjustment.value);
      if (parsedValue === null || parsedValue < 0 || parsedValue > MAX_AMOUNT_CENTS)
        return setError('Enter a valid discount or charge value.'), null;
      const tiers: MarketAdjustment['tiers'] = [];
      if (adjustment.type === 'PER_AMOUNT') {
        for (const tier of adjustment.tiers) {
          const quantity = Number(tier.quantity);
          const priceCents = parseDollarsToCents(tier.price);
          if (!Number.isInteger(quantity) || quantity < 1 || priceCents === null || priceCents < 0 || priceCents > MAX_AMOUNT_CENTS)
            return setError('Enter a valid quantity and bundle price for every tier.'), null;
          tiers.push({ quantity, priceCents });
        }
      }
      const buyCount = Number(adjustment.buyCount);
      const getCount = Number(adjustment.getCount);
      if (
        adjustment.type === 'PRESET' &&
        (!Number.isInteger(buyCount) || buyCount < 1 || !Number.isInteger(getCount) || getCount < 1)
      )
        return setError('Enter valid buy and get quantities for the preset deal.'), null;
      parsedAdjustments.push({
        kind: adjustment.kind,
        type: adjustment.type,
        merchType: adjustment.merchType,
        valueMode: adjustment.valueMode,
        value: adjustment.valueMode === 'AMOUNT' ? parsedValue : parsedValue,
        buyCount: adjustment.type === 'PRESET' ? buyCount : null,
        getCount: adjustment.type === 'PRESET' ? getCount : null,
        tiers,
      });
    }
    if (parsedLines.length === 0 && tipCents === 0)
      return setError('Add an item or enter a tip for the sale.'), null;
    return {
      soldAt: soldAt.toISOString(),
      currency,
      tipCents,
      items: parsedLines,
      adjustments: parsedAdjustments,
      adjustmentIds: tipOnly ? [] : adjustmentIds,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const input = submitInput();
    if (!input) return;
    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (reason) {
      setError(getErrorMessage(reason));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={sale ? 'Edit market sale' : 'Add market sale'}
      onClose={onCancel}
      size="large"
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" form="market-sale-form" className="button" disabled={submitting || !!currencyError || !currencyRates || (!tipOnly && (!!itemsError || !!catalogAdjustmentsError || !catalogAdjustments || sale?.items.some((line) => line.itemId === null)))}>
            {submitting ? 'Saving…' : tipOnly ? 'Save tip' : 'Save sale'}
          </button>
        </>
      }
    >
      <form id="market-sale-form" className="item-form" onSubmit={handleSubmit} noValidate>
        <div className="market-sale__mode" role="group" aria-label="Market transaction type">
          <button type="button" className={`choice${tipOnly ? '' : ' is-selected'}`} aria-pressed={!tipOnly} onClick={() => setTipOnly(false)}>
            Item sale
          </button>
          <button type="button" className={`choice${tipOnly ? ' is-selected' : ''}`} aria-pressed={tipOnly} onClick={() => setTipOnly(true)}>
            Tip only
          </button>
        </div>
        <div className="market-form__grid">
          <label>
            Date and time
            <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} disabled={!currencyRates}>
              {(currencyRates?.currencies ?? []).map(({ code, name }) => (
                <option key={code} value={code} disabled={!currencyRates?.cadPerUnit[code]}>{code} — {name}</option>
              ))}
            </select>
          </label>
        </div>
        {currencyError && <p className="form-error" role="alert">Could not load currencies: {currencyError}</p>}
        <label className="market-sale__tip">
          {tipOnly ? `Tip amount (${currency})` : `Add tip to this sale (${currency})`}
          <input inputMode="decimal" value={tip} onChange={(event) => setTip(event.target.value)} />
          {tipOnly && <span className="muted">Record a tip without adding an inventory item.</span>}
        </label>
        {!tipOnly && (
        <>
        <h3>Items sold</h3>
        {itemsError && <p className="form-error">Could not load inventory: {itemsError}</p>}
        {sale?.items.some((line) => line.itemId === null) && (
          <p className="form-error">This sale includes a deleted inventory item and cannot be edited.</p>
        )}
        {lines.map((line, index) => {
          const item = itemById.get(Number(line.itemId));
          return (
            <div className="market-sale-line" key={line.key}>
              <div>
                <span className="market-sale-line__index">Item {index + 1}</span>
                <div className="market-sale-line__fields">
                  <label>
                    Item
                    <select value={line.itemId} onChange={(event) => updateLine(line.key, { itemId: event.target.value })}>
                      <option value="">Choose inventory item</option>
                      {items.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}{choice.active ? ` (${choice.quantity} in stock)` : ' (inactive)'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Qty
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                    />
                  </label>
                  <label>
                    Unit price ({currency})
                    <input
                      inputMode="decimal"
                      placeholder={defaultMarketPrice(item)}
                      value={line.price}
                      disabled={line.free || line.trade}
                      onChange={(event) => updateLine(line.key, { price: event.target.value })}
                    />
                  </label>
                </div>
                <div className="market-sale-line__flags">
                  <label className="item-form__check">
                    <input
                      type="checkbox"
                      checked={line.free}
                      onChange={(event) => updateLine(line.key, { free: event.target.checked, trade: false })}
                    />
                    Free
                  </label>
                  <label className="item-form__check">
                    <input
                      type="checkbox"
                      checked={line.trade}
                      onChange={(event) => updateLine(line.key, { trade: event.target.checked, free: false })}
                    />
                    Trade
                  </label>
                </div>
              </div>
              <button
                type="button"
                className="button button--ghost market-sale-line__remove"
                onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                aria-label={`Remove item ${index + 1}`}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button type="button" className="button button--secondary" onClick={() => setLines((current) => [...current, newLine()])}>
          Add item
        </button>

        <fieldset className="adjustment-picker">
          <legend>Saved discounts &amp; charges</legend>
          {catalogAdjustmentsError && <p className="form-error" role="alert">Could not load discounts and charges: {catalogAdjustmentsError}</p>}
          {!catalogAdjustments && !catalogAdjustmentsError && <p className="muted">Loading discounts and charges…</p>}
          {catalogAdjustments?.filter((adjustment) => adjustment.active || adjustmentIds.includes(adjustment.id)).map((adjustment) => (
            <label className="item-form__check" key={adjustment.id}>
              <input
                type="checkbox"
                checked={adjustmentIds.includes(adjustment.id)}
                disabled={!adjustment.active && !adjustmentIds.includes(adjustment.id)}
                onChange={() => toggleCatalogAdjustment(adjustment.id)}
              />
              {adjustment.name} — {adjustment.kind === 'DISCOUNT' ? 'discount' : 'charge'}
              {adjustment.operation === 'AMOUNT'
                ? ` ${formatCents(adjustment.value)} CAD${adjustment.scope === 'SALE' ? ' per sale' : ' per eligible item'}`
                : adjustment.operation === 'PERCENTAGE'
                  ? ` ${(adjustment.value / 100).toFixed(2)}%`
                  : ` buy ${adjustment.buyQuantity}, get ${adjustment.freeQuantity} free`}
              {!adjustment.active && ' (archived)'}
            </label>
          ))}
          {catalogAdjustments?.length === 0 && <p className="muted">Add reusable rules in the Discounts &amp; Charges tab.</p>}
        </fieldset>

        <div className="market-adjustments">
          <div className="market-adjustments__header">
            <h3>Market-only promotions</h3>
            <button type="button" className="button button--secondary" onClick={() => setAdjustments((current) => [...current, newAdjustment()])}>
              Add rule
            </button>
          </div>
          <p className="muted">These one-off rules apply to this market sale only. Save reusable rules in Discounts &amp; Charges.</p>
          {adjustments.map((adjustment, index) => (
            <fieldset className="market-adjustment" key={adjustment.key}>
              <legend>Rule {index + 1}</legend>
              <div className="market-form__grid">
                <label>
                  Kind
                  <select
                    value={adjustment.kind}
                    onChange={(event) => {
                      const kind = event.target.value as MarketAdjustment['kind'];
                      updateAdjustment(adjustment.key, {
                        kind,
                        type: kind === 'CHARGE' ? 'SOLID_AMOUNT' : adjustment.type,
                      });
                    }}
                  >
                    <option value="DISCOUNT">Discount</option>
                    <option value="CHARGE">Charge</option>
                  </select>
                </label>
                <label>
                  Deal
                  <select
                    value={adjustment.type}
                    disabled={adjustment.kind === 'CHARGE'}
                    onChange={(event) => updateAdjustment(adjustment.key, { type: event.target.value as MarketAdjustment['type'] })}
                  >
                    <option value="SOLID_AMOUNT">Solid amount</option>
                    <option value="PRESET">Buy X get Y</option>
                    <option value="PER_AMOUNT">Bundle tiers</option>
                  </select>
                </label>
                <label>
                  Merchandise type
                  <select value={adjustment.merchType} onChange={(event) => updateAdjustment(adjustment.key, { merchType: event.target.value })}>
                    <option value="">All merchandise</option>
                    {merchTypes.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </label>
              </div>
              {adjustment.type === 'SOLID_AMOUNT' && (
                <div className="market-form__grid">
                  <label>
                    Value type
                    <select value={adjustment.valueMode} onChange={(event) => updateAdjustment(adjustment.key, { valueMode: event.target.value as MarketAdjustment['valueMode'] })}>
                      <option value="AMOUNT">Amount per item</option>
                      <option value="PERCENTAGE">Percentage per item</option>
                    </select>
                  </label>
                  <label>
                    {adjustment.valueMode === 'AMOUNT' ? `Amount (${market.currency})` : 'Percentage'}
                    <input
                      type={adjustment.valueMode === 'PERCENTAGE' ? 'number' : 'text'}
                      min={adjustment.valueMode === 'PERCENTAGE' ? '0' : undefined}
                      max={adjustment.valueMode === 'PERCENTAGE' ? '100' : undefined}
                      step={adjustment.valueMode === 'PERCENTAGE' ? '0.01' : undefined}
                      inputMode="decimal"
                      value={adjustment.value}
                      placeholder={adjustment.valueMode === 'PERCENTAGE' ? 'e.g. 10' : '0.00'}
                      onChange={(event) => updateAdjustment(adjustment.key, { value: event.target.value })}
                    />
                  </label>
                </div>
              )}
              {adjustment.type === 'PRESET' && (
                <>
                  <div className="market-form__grid">
                    <label>Buy<input type="number" min="1" value={adjustment.buyCount} onChange={(event) => updateAdjustment(adjustment.key, { buyCount: event.target.value })} /></label>
                    <label>Get<input type="number" min="1" value={adjustment.getCount} onChange={(event) => updateAdjustment(adjustment.key, { getCount: event.target.value })} /></label>
                    <label>Discount type
                      <select value={adjustment.valueMode} onChange={(event) => updateAdjustment(adjustment.key, { valueMode: event.target.value as MarketAdjustment['valueMode'] })}>
                        <option value="AMOUNT">Amount off per eligible item</option>
                        <option value="PERCENTAGE">Percentage off</option>
                      </select>
                    </label>
                    <label>{adjustment.valueMode === 'AMOUNT' ? `Amount (${market.currency})` : 'Percentage'}
                      <input
                        type={adjustment.valueMode === 'PERCENTAGE' ? 'number' : 'text'}
                        min={adjustment.valueMode === 'PERCENTAGE' ? '0' : undefined}
                        max={adjustment.valueMode === 'PERCENTAGE' ? '100' : undefined}
                        step={adjustment.valueMode === 'PERCENTAGE' ? '0.01' : undefined}
                        inputMode="decimal"
                        value={adjustment.value}
                        onChange={(event) => updateAdjustment(adjustment.key, { value: event.target.value })}
                      />
                    </label>
                  </div>
                  <p className="muted">The discount applies to the cheapest eligible items in each buy-and-get group.</p>
                </>
              )}
              {adjustment.type === 'PER_AMOUNT' && (
                <div className="market-adjustment__tiers">
                  <p>Bundle price by quantity (for example: buy 2 for $25).</p>
                  {adjustment.tiers.map((tier) => (
                    <div className="market-adjustment__tier" key={tier.key}>
                      <label>Quantity<input type="number" min="1" value={tier.quantity} onChange={(event) => updateAdjustment(adjustment.key, { tiers: adjustment.tiers.map((current) => current.key === tier.key ? { ...current, quantity: event.target.value } : current) })} /></label>
                      <label>Bundle price ({market.currency})<input inputMode="decimal" value={tier.price} onChange={(event) => updateAdjustment(adjustment.key, { tiers: adjustment.tiers.map((current) => current.key === tier.key ? { ...current, price: event.target.value } : current) })} /></label>
                      {adjustment.tiers.length > 1 && <button type="button" className="button button--ghost" onClick={() => updateAdjustment(adjustment.key, { tiers: adjustment.tiers.filter((current) => current.key !== tier.key) })}>Remove tier</button>}
                    </div>
                  ))}
                  <button type="button" className="button button--secondary" onClick={() => updateAdjustment(adjustment.key, { tiers: [...adjustment.tiers, { key: key(), quantity: '', price: '' }] })}>Add tier</button>
                </div>
              )}
              <button type="button" className="button button--ghost" onClick={() => setAdjustments((current) => current.filter((entry) => entry.key !== adjustment.key))}>Remove rule</button>
            </fieldset>
          ))}
        </div>
        </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
