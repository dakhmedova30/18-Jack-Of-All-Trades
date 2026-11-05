import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../../api/http';
import {
  createMarket,
  createMarketSale,
  deleteMarket,
  deleteMarketSale,
  listMarkets,
  updateMarket,
  updateMarketSale,
} from '../../api/markets';
import { getCurrencyRates } from '../../api/currencies';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon } from '../../components/icons';
import { MarketFormModal } from './MarketFormModal';
import { MarketSaleModal } from './MarketSaleModal';
import { formatCents, formatCentsIn } from '../../utils/money';
import { formatDate } from '../../utils/date';
import type { CurrencyRates, Market, MarketInput, MarketSale, MarketSaleInput } from '../../types';

type MarketFormState = 'create' | { mode: 'edit'; market: Market } | null;
type SaleFormState = 'create' | 'tip' | { mode: 'edit'; sale: MarketSale } | null;
type DeleteState = { kind: 'market'; market: Market } | { kind: 'sale'; sale: MarketSale } | null;

function marketYear(market: Market) {
  const first = market.dates[0];
  return first ? new Date(first.startsAt).getUTCFullYear() : '—';
}

function marketDateSummary(market: Market) {
  return market.dates.map((date) => formatDate(date.startsAt)).join(', ');
}

function googleMapsLink(market: Market) {
  const query = market.locationLatitude !== null && market.locationLongitude !== null
    ? `${market.locationLatitude},${market.locationLongitude}`
    : market.location;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function MarketsPage() {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyRates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [marketForm, setMarketForm] = useState<MarketFormState>(null);
  const [saleForm, setSaleForm] = useState<SaleFormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteState>(null);

  const selectedMarket = useMemo(
    () => markets?.find((market) => market.id === selectedId) ?? null,
    [markets, selectedId],
  );

  async function reload() {
    setError(null);
    try {
      const [nextMarkets, rates] = await Promise.all([listMarkets(), getCurrencyRates()]);
      setMarkets(nextMarkets);
      setCurrencies(rates);
      setSelectedId((current) =>
        current !== null && nextMarkets.some((market) => market.id === current)
          ? current
          : nextMarkets[0]?.id ?? null,
      );
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function saveMarket(input: MarketInput) {
    if (marketForm && typeof marketForm === 'object') {
      await updateMarket(marketForm.market.id, input);
      setSelectedId(marketForm.market.id);
    } else {
      const created = await createMarket(input);
      setSelectedId(created.id);
    }
    setMarketForm(null);
    await reload();
  }

  async function saveSale(input: MarketSaleInput) {
    if (!selectedMarket) return;
    if (saleForm && typeof saleForm === 'object')
      await updateMarketSale(selectedMarket.id, saleForm.sale.id, input);
    else await createMarketSale(selectedMarket.id, input);
    setSaleForm(null);
    await reload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'market') {
      await deleteMarket(deleteTarget.market.id);
      if (selectedId === deleteTarget.market.id) setSelectedId(null);
    } else if (selectedMarket) {
      await deleteMarketSale(selectedMarket.id, deleteTarget.sale.id);
    }
    setDeleteTarget(null);
    await reload();
  }

  return (
    <section className="page">
      <header className="market-page__header">
        <div>
          <h1>In-Person Market</h1>
          <p className="muted">Plan markets, record in-person sales, and track fees, tips and profit.</p>
        </div>
        <button type="button" className="button" onClick={() => setMarketForm('create')}>
          Add market <PlusIcon />
        </button>
      </header>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}{' '}
          <button type="button" className="link-button" onClick={() => void reload()}>Retry</button>
        </div>
      )}

      {selectedMarket && (
        <>
          <div className="market-summary">
            <article className="summary-panel"><span>Revenue</span><strong>{formatCents(selectedMarket.salesCadCents + selectedMarket.tipsCadCents)}</strong></article>
            <article className="summary-panel"><span>Expenses</span><strong>{formatCents(selectedMarket.expensesCadCents)}</strong></article>
            <article className="summary-panel"><span>Profit</span><strong>{formatCents(selectedMarket.profitCadCents)}</strong></article>
            <article className="summary-panel"><span>Tips</span><strong>{formatCents(selectedMarket.tipsCadCents)}</strong></article>
          </div>

          <section className="market-detail panel">
            <div className="market-detail__header">
              <div>
                <h2>{selectedMarket.name}</h2>
                <p className="muted">
                  {marketDateSummary(selectedMarket)}
                  {selectedMarket.location && <> · <a href={googleMapsLink(selectedMarket)} target="_blank" rel="noreferrer">View map</a></>}
                  {' '}· {selectedMarket.attending ? 'Attending' : 'Not attending'} · {selectedMarket.status}
                </p>
                <p className="muted">
                  Table fee {formatCentsIn(selectedMarket.tableFeeCents, selectedMarket.currency)}
                  {' '}· Other expenses {formatCentsIn(selectedMarket.extraExpensesCents, selectedMarket.currency)}
                </p>
              </div>
              <div className="toolbar__actions">
                <button type="button" className="button button--secondary" onClick={() => setMarketForm({ mode: 'edit', market: selectedMarket })}>Edit market</button>
                <button type="button" className="button button--secondary" onClick={() => setDeleteTarget({ kind: 'market', market: selectedMarket })}>Delete market</button>
                <button type="button" className="button button--secondary" onClick={() => setSaleForm('tip')}>Add tip</button>
                <button type="button" className="button" onClick={() => setSaleForm('create')}>Add sale <PlusIcon /></button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Items</th><th className="numeric">Sale total</th><th className="numeric">Tip</th><th className="numeric">Total</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {selectedMarket.sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{formatDate(sale.soldAt)} {new Date(sale.soldAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                      <td>
                        {sale.items.map((item) => `${item.itemName} × ${item.quantity}${item.free ? ' (free)' : item.trade ? ' (trade)' : ''}`).join(', ') || 'Tip only'}
                        {sale.appliedAdjustments.length > 0 && (
                          <span className="muted adjustment-summary">
                            Adjustments: {sale.appliedAdjustments.map((adjustment) => adjustment.name).join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="numeric">{formatCentsIn(sale.totalCents, sale.currency)}</td>
                      <td className="numeric">{formatCentsIn(sale.tipCents, sale.currency)}</td>
                      <td className="numeric">{formatCents(sale.totalCadCents + sale.tipCadCents)}</td>
                      <td className="market-table__actions">
                        <button type="button" className="link-button" onClick={() => setSaleForm({ mode: 'edit', sale })}>Edit</button>
                        <button type="button" className="link-button danger-link" onClick={() => setDeleteTarget({ kind: 'sale', sale })}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {selectedMarket.sales.length === 0 && <tr><td colSpan={6} className="muted">No sales recorded for this market yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="muted market-detail__footnote">
              Sale and tip amounts are converted to CAD using the rate recorded when each sale was entered.
              Free items and trades reduce inventory but are not included in revenue.
            </p>
          </section>
        </>
      )}

      <div className="market-list__header">
        <h2>Markets by year</h2>
        <span className="muted">{markets?.length ?? 0} markets</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Year</th><th>Market</th><th>Date(s)</th><th>Location</th><th>Status</th><th>Going?</th><th className="numeric">Expenses (CAD)</th><th className="numeric">Revenue (CAD)</th><th className="numeric">Profit (CAD)</th></tr>
          </thead>
          <tbody>
            {markets?.map((market) => (
              <tr
                key={market.id}
                className={selectedId === market.id ? 'market-list__selected' : undefined}
                onClick={() => setSelectedId(market.id)}
              >
                <td>{marketYear(market)}</td>
                <td><button type="button" className="link-button" onClick={() => setSelectedId(market.id)}>{market.name}</button></td>
                <td>{marketDateSummary(market)}</td>
                <td>{market.location}</td>
                <td>{market.status}</td>
                <td>{market.attending ? 'Yes' : 'No'}</td>
                <td className="numeric">{formatCents(market.expensesCadCents)}</td>
                <td className="numeric">{formatCents(market.salesCadCents + market.tipsCadCents)}</td>
                <td className="numeric">{formatCents(market.profitCadCents)}</td>
              </tr>
            ))}
            {!loading && markets?.length === 0 && (
              <tr><td colSpan={9} className="muted">No markets yet. Add one to get started.</td></tr>
            )}
            {loading && <tr><td colSpan={9} className="muted">Loading markets…</td></tr>}
          </tbody>
        </table>
      </div>

      {marketForm && currencies && (
        <MarketFormModal
          market={typeof marketForm === 'object' ? marketForm.market : undefined}
          currencies={currencies}
          onCancel={() => setMarketForm(null)}
          onSubmit={saveMarket}
        />
      )}
      {saleForm && selectedMarket && (
        <MarketSaleModal
          market={selectedMarket}
          sale={typeof saleForm === 'object' ? saleForm.sale : undefined}
          initialTipOnly={saleForm === 'tip'}
          onCancel={() => setSaleForm(null)}
          onSubmit={saveSale}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={deleteTarget.kind === 'market' ? 'Delete market?' : 'Delete market sale?'}
          message={deleteTarget.kind === 'market'
            ? 'This removes the market and its recorded sales. Sold items will be returned to inventory.'
            : 'This removes the sale and returns its items to inventory.'}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
}
