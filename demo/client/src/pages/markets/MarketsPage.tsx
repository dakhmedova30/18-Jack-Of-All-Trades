import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../../api/http';
import {
  createMarket,
  createMarketSale,
  bulkDeleteMarketSales,
  bulkDeleteMarkets,
  deleteMarket,
  deleteMarketSale,
  listMarkets,
  updateMarket,
  updateMarketSale,
} from '../../api/markets';
import { getCurrencyRates } from '../../api/currencies';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, SearchIcon } from '../../components/icons';
import { MarketFormModal } from './MarketFormModal';
import { MarketSaleModal } from './MarketSaleModal';
import { formatCentsIn } from '../../utils/money';
import { formatDate } from '../../utils/date';
import type { CurrencyRates, Market, MarketInput, MarketSale, MarketSaleInput } from '../../types';
import { useReportingCurrency } from '../../hooks/useReportingCurrency';

type MarketFormState = 'create' | { mode: 'edit'; market: Market } | null;
type SaleFormState = 'create' | 'tip' | { mode: 'edit'; sale: MarketSale } | null;
type DeleteState =
  | { kind: 'market'; market: Market }
  | { kind: 'markets'; ids: number[] }
  | { kind: 'sale'; sale: MarketSale }
  | { kind: 'sales'; ids: number[] }
  | null;

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
  const { currency: reportingCurrency, error: reportingCurrencyError, formatCad } = useReportingCurrency();
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyRates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [marketForm, setMarketForm] = useState<MarketFormState>(null);
  const [saleForm, setSaleForm] = useState<SaleFormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteState>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<number>>(new Set());
  const [selectedMarketIds, setSelectedMarketIds] = useState<Set<number>>(new Set());
  const [marketSearch, setMarketSearch] = useState('');
  const [marketStatusFilter, setMarketStatusFilter] = useState('');
  const [marketYearFilter, setMarketYearFilter] = useState('');
  const [marketCurrencyFilter, setMarketCurrencyFilter] = useState('');
  const [attendingFilter, setAttendingFilter] = useState('');
  const [saleSearch, setSaleSearch] = useState('');
  const [saleFrom, setSaleFrom] = useState('');
  const [saleTo, setSaleTo] = useState('');
  const [saleCurrencyFilter, setSaleCurrencyFilter] = useState('');

  useEffect(() => {
    setSelectedSaleIds(new Set());
  }, [selectedId]);

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
    } else if (deleteTarget.kind === 'markets') {
      await bulkDeleteMarkets(deleteTarget.ids);
      if (selectedId !== null && deleteTarget.ids.includes(selectedId)) setSelectedId(null);
    } else if (deleteTarget.kind === 'sale' && selectedMarket) {
      await deleteMarketSale(selectedMarket.id, deleteTarget.sale.id);
    } else if (deleteTarget.kind === 'sales' && selectedMarket) {
      await bulkDeleteMarketSales(selectedMarket.id, deleteTarget.ids);
    }
    setSelectedSaleIds(new Set());
    setSelectedMarketIds(new Set());
    setDeleteTarget(null);
    await reload();
  }

  const filteredMarkets = (markets ?? []).filter((market) => {
    const text = `${market.id} ${market.name} ${market.location} ${market.locationLatitude ?? ''} ${market.locationLongitude ?? ''} ${market.currency} ${market.tableFeeCents} ${market.extraExpensesCents} ${market.status} ${market.attending} ${market.dates.map((date) => `${date.startsAt} ${date.endsAt}`).join(' ')}`.toLowerCase();
    return (!marketSearch || text.includes(marketSearch.trim().toLowerCase()))
      && (!marketStatusFilter || market.status === marketStatusFilter)
      && (!marketYearFilter || String(marketYear(market)) === marketYearFilter)
      && (!marketCurrencyFilter || market.currency === marketCurrencyFilter)
      && (!attendingFilter || String(market.attending) === attendingFilter);
  });
  const visibleSales = selectedMarket?.sales.filter((sale) => {
    const text = `${sale.id} ${sale.soldAt} ${sale.currency} ${sale.tipCents} ${sale.totalCents} ${sale.items.map((item) => `${item.itemName} ${item.quantity} ${item.unitPriceCents} ${item.totalCents} ${item.free} ${item.trade}`).join(' ')} ${sale.appliedAdjustments.map((adjustment) => `${adjustment.name} ${adjustment.amountCents}`).join(' ')}`.toLowerCase();
    const date = sale.soldAt.slice(0, 10);
    return (!saleSearch || text.includes(saleSearch.trim().toLowerCase()))
      && (!saleFrom || date >= saleFrom)
      && (!saleTo || date <= saleTo)
      && (!saleCurrencyFilter || sale.currency === saleCurrencyFilter);
  }) ?? [];
  const allSalesSelected = visibleSales.length > 0 && visibleSales.every((sale) => selectedSaleIds.has(sale.id));
  const allMarketsSelected = filteredMarkets.length > 0
    && filteredMarkets.every((market) => selectedMarketIds.has(market.id));

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
      {reportingCurrencyError && <div className="banner banner--error" role="alert">Could not load reporting currency rates: {reportingCurrencyError}</div>}

      {selectedMarket && (
        <>
          <div className="market-summary">
            <article className="summary-panel"><span>Revenue ({reportingCurrency})</span><strong>{formatCad(selectedMarket.salesCadCents + selectedMarket.tipsCadCents)}</strong></article>
            <article className="summary-panel"><span>Expenses ({reportingCurrency})</span><strong>{formatCad(selectedMarket.expensesCadCents)}</strong></article>
            <article className="summary-panel"><span>Profit ({reportingCurrency})</span><strong>{formatCad(selectedMarket.profitCadCents)}</strong></article>
            <article className="summary-panel"><span>Tips ({reportingCurrency})</span><strong>{formatCad(selectedMarket.tipsCadCents)}</strong></article>
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
                <button type="button" className="button button--secondary" disabled={selectedSaleIds.size === 0} onClick={() => setDeleteTarget({ kind: 'sales', ids: [...selectedSaleIds] })}>Bulk delete sales{selectedSaleIds.size > 0 && ` (${selectedSaleIds.size})`}</button>
                <button type="button" className="button button--secondary" onClick={() => setSaleForm('tip')}>Add tip</button>
                <button type="button" className="button" onClick={() => setSaleForm('create')}>Add sale <PlusIcon /></button>
              </div>
            </div>
            <div className="toolbar__filters" aria-label="Filter market sales">
              <label>Search<input type="search" value={saleSearch} onChange={(event) => setSaleSearch(event.target.value)} placeholder="ID, item, adjustment, amount" /></label>
              <label>From<input type="date" value={saleFrom} onChange={(event) => setSaleFrom(event.target.value)} /></label>
              <label>To<input type="date" value={saleTo} onChange={(event) => setSaleTo(event.target.value)} /></label>
              <label>Currency<select value={saleCurrencyFilter} onChange={(event) => setSaleCurrencyFilter(event.target.value)}><option value="">All currencies</option>{(currencies?.currencies ?? []).map(({ code, name }) => <option key={code} value={code}>{code} — {name}</option>)}</select></label>
              {(saleSearch || saleFrom || saleTo || saleCurrencyFilter) && <button type="button" className="button button--secondary" onClick={() => { setSaleSearch(''); setSaleFrom(''); setSaleTo(''); setSaleCurrencyFilter(''); }}>Clear filters</button>}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th className="table__check"><input type="checkbox" checked={allSalesSelected} onChange={() => setSelectedSaleIds((current) => {
                    const next = new Set(current);
                    for (const sale of visibleSales) allSalesSelected ? next.delete(sale.id) : next.add(sale.id);
                    return next;
                  })} aria-label="Select all market sales" /></th><th>ID</th><th>Date</th><th>Items</th><th className="numeric">Sale total</th><th className="numeric">Tip</th><th className="numeric">Total</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {visibleSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="table__check" onClick={(event) => event.stopPropagation()}>
                        <input type="checkbox" checked={selectedSaleIds.has(sale.id)} onChange={() => setSelectedSaleIds((current) => {
                          const next = new Set(current);
                          next.has(sale.id) ? next.delete(sale.id) : next.add(sale.id);
                          return next;
                        })} aria-label={`Select market sale ${sale.id}`} />
                      </td>
                      <td>{sale.id}</td>
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
                      <td className="numeric">{formatCad(sale.totalCadCents + sale.tipCadCents)}</td>
                      <td className="market-table__actions">
                        <button type="button" className="link-button" onClick={() => setSaleForm({ mode: 'edit', sale })}>Edit</button>
                        <button type="button" className="link-button danger-link" onClick={() => setDeleteTarget({ kind: 'sale', sale })}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {visibleSales.length === 0 && <tr><td colSpan={8} className="muted">No market sales match the selected filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="muted market-detail__footnote">
              Sale and tip amounts are converted to {reportingCurrency} using the rate recorded when each sale was entered.
              Free items and trades reduce inventory but are not included in revenue.
            </p>
          </section>
        </>
      )}

      <div className="market-list__header">
        <h2>Markets by year</h2>
        <div className="toolbar__actions">
          <span className="muted">{markets?.length ?? 0} markets</span>
          <button type="button" className="button button--secondary" disabled={selectedMarketIds.size === 0} onClick={() => setDeleteTarget({ kind: 'markets', ids: [...selectedMarketIds] })}>Bulk delete{selectedMarketIds.size > 0 && ` (${selectedMarketIds.size})`}</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <label htmlFor="market-search">Search markets</label>
          <div className="search"><input id="market-search" type="search" value={marketSearch} onChange={(event) => setMarketSearch(event.target.value)} placeholder="Search market details or ID" /><SearchIcon /></div>
        </div>
        <div className="toolbar__filters" aria-label="Filter markets">
          <label>Year<select value={marketYearFilter} onChange={(event) => setMarketYearFilter(event.target.value)}><option value="">All years</option>{[...new Set((markets ?? []).map(marketYear).filter((year): year is number => typeof year === 'number'))].sort((a, b) => b - a).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label>Status<select value={marketStatusFilter} onChange={(event) => setMarketStatusFilter(event.target.value)}><option value="">All statuses</option><option value="planned">Planned</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
          <label>Currency<select value={marketCurrencyFilter} onChange={(event) => setMarketCurrencyFilter(event.target.value)}><option value="">All currencies</option>{(currencies?.currencies ?? []).map(({ code, name }) => <option key={code} value={code}>{code} — {name}</option>)}</select></label>
          <label>Attending<select value={attendingFilter} onChange={(event) => setAttendingFilter(event.target.value)}><option value="">All</option><option value="true">Yes</option><option value="false">No</option></select></label>
          {(marketSearch || marketYearFilter || marketStatusFilter || marketCurrencyFilter || attendingFilter) && <button type="button" className="button button--secondary" onClick={() => { setMarketSearch(''); setMarketYearFilter(''); setMarketStatusFilter(''); setMarketCurrencyFilter(''); setAttendingFilter(''); setSelectedMarketIds(new Set()); }}>Clear filters</button>}
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th className="table__check"><input type="checkbox" checked={allMarketsSelected} onChange={() => setSelectedMarketIds((current) => { const next = new Set(current); for (const market of filteredMarkets) allMarketsSelected ? next.delete(market.id) : next.add(market.id); return next; })} aria-label="Select all markets shown" /></th><th>ID</th><th>Year</th><th>Market</th><th>Date(s)</th><th>Location</th><th>Status</th><th>Going?</th><th className="numeric">Expenses ({reportingCurrency})</th><th className="numeric">Revenue ({reportingCurrency})</th><th className="numeric">Profit ({reportingCurrency})</th></tr>
          </thead>
          <tbody>
            {filteredMarkets.map((market) => (
              <tr
                key={market.id}
                className={selectedId === market.id ? 'market-list__selected' : undefined}
                onClick={() => setSelectedId(market.id)}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={selectedMarketIds.has(market.id)} onChange={() => setSelectedMarketIds((current) => {
                    const next = new Set(current);
                    next.has(market.id) ? next.delete(market.id) : next.add(market.id);
                    return next;
                  })} aria-label={`Select market ${market.id}`} />
                </td>
                <td>{market.id}</td>
                <td>{marketYear(market)}</td>
                <td><button type="button" className="link-button" onClick={() => setSelectedId(market.id)}>{market.name}</button></td>
                <td>{marketDateSummary(market)}</td>
                <td>{market.location}</td>
                <td>{market.status}</td>
                <td>{market.attending ? 'Yes' : 'No'}</td>
                <td className="numeric">{formatCad(market.expensesCadCents)}</td>
                <td className="numeric">{formatCad(market.salesCadCents + market.tipsCadCents)}</td>
                <td className="numeric">{formatCad(market.profitCadCents)}</td>
              </tr>
            ))}
            {!loading && filteredMarkets.length === 0 && (
              <tr><td colSpan={11} className="muted">No markets yet. Add one to get started.</td></tr>
            )}
            {loading && <tr><td colSpan={11} className="muted">Loading markets…</td></tr>}
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
            : deleteTarget.kind === 'markets'
              ? `This removes ${deleteTarget.ids.length} markets and returns all sold items to inventory.`
              : deleteTarget.kind === 'sale'
                ? `This removes sale #${deleteTarget.sale.id} and returns its items to inventory.`
                : `This removes ${deleteTarget.ids.length} sales and returns their items to inventory.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
}
