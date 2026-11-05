import { useEffect, useState } from 'react';
import { listChannels } from '../../api/channels';
import { bulkDeleteExpenses, deleteExpense, updateExpense, createExpense } from '../../api/expenses';
import { bulkDeleteSales, deleteSale, updateSale, createSale } from '../../api/sales';
import { getOnlineShopMonthlySummary } from '../../api/onlineShop';
import { getCurrencyRates } from '../../api/currencies';
import { getErrorMessage } from '../../api/http';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Pagination } from '../../components/Pagination';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { useExpenses } from '../../hooks/useExpenses';
import { useSales } from '../../hooks/useSales';
import { usePreferences } from '../../hooks/usePreferences';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useReportingCurrency } from '../../hooks/useReportingCurrency';
import { ExpenseFormModal } from '../expenses/ExpenseFormModal';
import { SaleFormModal } from '../sales/SaleFormModal';
import type {
  Channel,
  Expense,
  ExpenseInput,
  OnlineShopSummary,
  CurrencyRates,
  Sale,
  SaleInput,
} from '../../types';
import { convertCents, formatCentsIn } from '../../utils/money';

const ONLINE_SHOP_TAG = 'online shop';
const PAGE_SIZE = 10;

type FormState =
  | { kind: 'sale'; mode: 'create' }
  | { kind: 'sale'; mode: 'edit'; sale: Sale }
  | { kind: 'expense'; mode: 'create' }
  | { kind: 'expense'; mode: 'edit'; expense: Expense }
  | null;
type DeleteTarget =
  | { kind: 'sale'; sale: Sale }
  | { kind: 'expense'; expense: Expense }
  | { kind: 'sales'; ids: number[] }
  | { kind: 'expenses'; ids: number[] }
  | null;

function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    month = new Date().toISOString().slice(0, 7);
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, monthNumber - 1, 1));
  const to = new Date(Date.UTC(year, monthNumber, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function OnlineShopPage() {
  const { formatDate } = usePreferences();
  const { currency: reportingCurrency, error: reportingCurrencyError, formatCad } = useReportingCurrency();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [currencyRates, setCurrencyRates] = useState<CurrencyRates | null>(null);
  const [currencyError, setCurrencyError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [summary, setSummary] = useState<OnlineShopSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryReload, setSummaryReload] = useState(0);
  const [salesPage, setSalesPage] = useState(1);
  const [expensesPage, setExpensesPage] = useState(1);
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [selectedSaleIds, setSelectedSaleIds] = useState<Set<number>>(new Set());
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<number>>(new Set());

  const onlineChannel = channels?.find((channel) => channel.name.toLowerCase() === 'online');
  const { from, to } = monthRange(month);
  const sales = useSales({
    page: salesPage,
    pageSize: PAGE_SIZE,
    sort: 'soldAt',
    order: 'desc',
    channelId: onlineChannel?.id ?? 0,
    search,
    currency: currencyFilter || undefined,
    from,
    to,
  });
  const expenses = useExpenses({
    page: expensesPage,
    pageSize: PAGE_SIZE,
    sort: 'incurredAt',
    order: 'desc',
    tag: ONLINE_SHOP_TAG,
    search,
    currency: currencyFilter || undefined,
    from,
    to,
  });

  useEffect(() => {
    getCurrencyRates()
      .then(setCurrencyRates)
      .catch((error: unknown) => setCurrencyError(getErrorMessage(error)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listChannels()
      .then((result) => {
        if (!cancelled) setChannels(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setChannelsError(getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    getOnlineShopMonthlySummary(month)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setSummaryError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, summaryReload]);

  function reload() {
    sales.reload();
    expenses.reload();
    setSummaryReload((current) => current + 1);
  }

  async function handleSaveSale(input: SaleInput) {
    if (formState?.kind === 'sale' && formState.mode === 'edit') {
      await updateSale(formState.sale.id, input);
    } else {
      await createSale(input);
    }
    setFormState(null);
    reload();
  }

  async function handleSaveExpense(input: ExpenseInput) {
    if (formState?.kind === 'expense' && formState.mode === 'edit') {
      await updateExpense(formState.expense.id, input);
    } else {
      await createExpense(input);
    }
    setFormState(null);
    reload();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'sale') await deleteSale(deleteTarget.sale.id);
    else if (deleteTarget.kind === 'expense') await deleteExpense(deleteTarget.expense.id);
    else if (deleteTarget.kind === 'sales') await bulkDeleteSales(deleteTarget.ids);
    else await bulkDeleteExpenses(deleteTarget.ids);
    if (deleteTarget.kind === 'sale' || deleteTarget.kind === 'sales') setSelectedSaleIds(new Set());
    else setSelectedExpenseIds(new Set());
    setDeleteTarget(null);
    reload();
  }

  function changeMonth(value: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
    setMonth(value);
    setSalesPage(1);
    setExpensesPage(1);
    setSelectedSaleIds(new Set());
    setSelectedExpenseIds(new Set());
  }

  const salesOnPage = sales.data?.data ?? [];
  const expensesOnPage = expenses.data?.data ?? [];
  const allSalesSelected = salesOnPage.length > 0 && salesOnPage.every((sale) => selectedSaleIds.has(sale.id));
  const allExpensesSelected = expensesOnPage.length > 0 && expensesOnPage.every((expense) => selectedExpenseIds.has(expense.id));

  function togglePageSelection(kind: 'sale' | 'expense') {
    if (kind === 'sale') {
      setSelectedSaleIds((current) => {
        const next = new Set(current);
        for (const sale of salesOnPage) allSalesSelected ? next.delete(sale.id) : next.add(sale.id);
        return next;
      });
    } else {
      setSelectedExpenseIds((current) => {
        const next = new Set(current);
        for (const expense of expensesOnPage) allExpensesSelected ? next.delete(expense.id) : next.add(expense.id);
        return next;
      });
    }
  }

  return (
    <section className="page online-shop">
      <header className="online-shop__header">
        <div>
          <h1>Online Shop</h1>
          <p className="muted">
            Track online orders, platform payouts, and shop expenses by month. Entries use the
            existing Online sales channel and shared inventory.
          </p>
        </div>
        <label className="online-shop__month">
          Month
          <input
            type="month"
            value={month}
            onChange={(event) => changeMonth(event.target.value)}
          />
        </label>
      </header>

      <p className="banner online-shop__note">
        Online orders are entered manually for now. Record the net amount shown by your platform;
        direct platform connections are not configured.
      </p>

      {channelsError && (
        <div className="banner banner--error" role="alert">
          Could not load sales channels: {channelsError}
        </div>
      )}
      {channels && !onlineChannel && (
        <div className="banner banner--error" role="alert">
          The Online sales channel is missing. Add or rename a channel to “Online” before recording
          shop orders.
        </div>
      )}

      <div className="toolbar">
        <div className="search-field">
          <label htmlFor="online-shop-search">Search records</label>
          <div className="search">
            <input
              id="online-shop-search"
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSalesPage(1);
                setExpensesPage(1);
                setSelectedSaleIds(new Set());
                setSelectedExpenseIds(new Set());
              }}
              placeholder="Search descriptions, people, items, or tags"
            />
            <SearchIcon />
          </div>
        </div>
        <label>
          Currency
          <select
            value={currencyFilter}
            onChange={(event) => {
              setCurrencyFilter(event.target.value);
              setSalesPage(1);
              setExpensesPage(1);
              setSelectedSaleIds(new Set());
              setSelectedExpenseIds(new Set());
            }}
          >
            <option value="">All currencies</option>
            {(currencyRates?.currencies ?? []).map(({ code, name }) => (
              <option key={code} value={code}>{code} — {name}</option>
            ))}
          </select>
        </label>
        {(searchInput || currencyFilter) && (
          <button type="button" className="button button--secondary" onClick={() => {
            setSearchInput('');
            setCurrencyFilter('');
            setSalesPage(1);
            setExpensesPage(1);
            setSelectedSaleIds(new Set());
            setSelectedExpenseIds(new Set());
          }}>
            Clear filters
          </button>
        )}
      </div>
      {currencyError && <div className="banner banner--error" role="alert">Could not load currencies: {currencyError}</div>}
      {reportingCurrencyError && <div className="banner banner--error" role="alert">Could not load reporting currency rates: {reportingCurrencyError}</div>}

      {summaryError && (
        <div className="banner banner--error" role="alert">
          Could not load this month’s totals: {summaryError}{' '}
          <button type="button" className="link-button" onClick={() => setSummaryReload((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className="online-shop__stats" aria-busy={summaryLoading}>
        <SummaryCard label="Sales" value={summary ? String(summary.saleCount) : summaryLoading ? '…' : '—'} />
        <SummaryCard label={`Net revenue (${reportingCurrency})`} value={summary ? formatCad(summary.revenueCents) : summaryLoading ? '…' : '—'} />
        <SummaryCard label={`Expenses (${reportingCurrency})`} value={summary ? formatCad(summary.expenseCents) : summaryLoading ? '…' : '—'} />
        <SummaryCard
          label={`Profit (${reportingCurrency})`}
          value={summary ? formatCad(summary.profitCents) : summaryLoading ? '…' : '—'}
          tone={summary && summary.profitCents < 0 ? 'negative' : 'positive'}
          detail="Net revenue less expenses tagged Online Shop"
        />
      </div>

      <section className="card online-shop__monthly">
        <div className="online-shop__section-heading">
          <div>
            <h2>Monthly view</h2>
            <p className="muted">{month}</p>
          </div>
        </div>
        {summaryError ? (
          <p className="empty-state">Monthly item totals are unavailable.</p>
        ) : summary?.itemsSold.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th className="numeric">Quantity</th></tr></thead>
              <tbody>
                {summary.itemsSold.map((item) => (
                  <tr key={item.itemName}><td>{item.itemName}</td><td className="numeric">{item.quantity}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">{summaryLoading ? 'Loading monthly items…' : 'No items sold this month.'}</p>
        )}
      </section>

      <section className="card online-shop__records">
        <div className="online-shop__section-heading">
          <div><h2>Sales</h2><p className="muted">Shop orders reduce inventory.</p></div>
          <div className="toolbar__actions">
            <button type="button" className="button button--secondary" disabled={selectedSaleIds.size === 0} onClick={() => setDeleteTarget({ kind: 'sales', ids: [...selectedSaleIds] })}>
              Bulk delete{selectedSaleIds.size > 0 && ` (${selectedSaleIds.size})`} <TrashIcon />
            </button>
            <button type="button" className="button" disabled={!onlineChannel} onClick={() => setFormState({ kind: 'sale', mode: 'create' })}>
              Add sale <PlusIcon />
            </button>
          </div>
        </div>
        {sales.error && <div className="banner banner--error" role="alert">{sales.error} <button type="button" className="link-button" onClick={sales.reload}>Retry</button></div>}
        <div className={`table-wrap${sales.loading && sales.data ? ' is-loading' : ''}`}>
          <table className="table">
            <thead><tr><th className="table__check"><input type="checkbox" checked={allSalesSelected} onChange={() => togglePageSelection('sale')} aria-label="Select all online sales on this page" /></th><th>ID</th><th>Date</th><th>Description</th><th className="numeric">Net received</th><th>Currency</th><th className="table__action">Delete</th></tr></thead>
            <tbody>
              {sales.data?.data.map((sale) => (
                <tr
                  key={sale.id}
                  className="table__row"
                  tabIndex={0}
                  aria-label={`Edit online sale ${sale.id}`}
                  onClick={() => setFormState({ kind: 'sale', mode: 'edit', sale })}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setFormState({ kind: 'sale', mode: 'edit', sale });
                    }
                  }}
                >
                  <td className="table__check" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selectedSaleIds.has(sale.id)} onChange={() => setSelectedSaleIds((current) => {
                      const next = new Set(current);
                      next.has(sale.id) ? next.delete(sale.id) : next.add(sale.id);
                      return next;
                    })} aria-label={`Select online sale ${sale.id}`} />
                  </td>
                  <td>{sale.id}</td>
                  <td>{formatDate(sale.soldAt)}</td>
                  <td>{sale.description || <span className="muted">—</span>}</td>
                  <td className="numeric">{formatSaleTotal(sale, currencyRates)}</td>
                  <td>{sale.currency}</td>
                  <td className="table__action" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="icon-button" aria-label={`Delete online sale ${sale.id}`} onClick={() => setDeleteTarget({ kind: 'sale', sale })}><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.data && sales.loading && <p className="empty-state">Loading online sales…</p>}
          {sales.data?.total === 0 && <p className="empty-state">No online sales match the selected filters.</p>}
        </div>
        {sales.data && <Pagination page={sales.data.page} totalPages={sales.data.totalPages} onPageChange={setSalesPage} />}
      </section>

      <section className="card online-shop__records">
        <div className="online-shop__section-heading">
          <div><h2>Expenses</h2><p className="muted">Only expenses tagged Online Shop are included in these totals.</p></div>
          <div className="toolbar__actions">
            <button type="button" className="button button--secondary" disabled={selectedExpenseIds.size === 0} onClick={() => setDeleteTarget({ kind: 'expenses', ids: [...selectedExpenseIds] })}>
              Bulk delete{selectedExpenseIds.size > 0 && ` (${selectedExpenseIds.size})`} <TrashIcon />
            </button>
            <button type="button" className="button" onClick={() => setFormState({ kind: 'expense', mode: 'create' })}>
              Add expense <PlusIcon />
            </button>
          </div>
        </div>
        {expenses.error && <div className="banner banner--error" role="alert">{expenses.error} <button type="button" className="link-button" onClick={expenses.reload}>Retry</button></div>}
        <div className={`table-wrap${expenses.loading && expenses.data ? ' is-loading' : ''}`}>
          <table className="table">
            <thead><tr><th className="table__check"><input type="checkbox" checked={allExpensesSelected} onChange={() => togglePageSelection('expense')} aria-label="Select all Online Shop expenses on this page" /></th><th>ID</th><th>Date</th><th>Description</th><th className="numeric">Total</th><th>Currency</th><th className="table__action">Delete</th></tr></thead>
            <tbody>
              {expenses.data?.data.map((expense) => (
                <tr
                  key={expense.id}
                  className="table__row"
                  tabIndex={0}
                  aria-label={`Edit Online Shop expense ${expense.id}`}
                  onClick={() => setFormState({ kind: 'expense', mode: 'edit', expense })}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setFormState({ kind: 'expense', mode: 'edit', expense });
                    }
                  }}
                >
                  <td className="table__check" onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selectedExpenseIds.has(expense.id)} onChange={() => setSelectedExpenseIds((current) => {
                      const next = new Set(current);
                      next.has(expense.id) ? next.delete(expense.id) : next.add(expense.id);
                      return next;
                    })} aria-label={`Select Online Shop expense ${expense.id}`} />
                  </td>
                  <td>{expense.id}</td>
                  <td>{formatDate(expense.incurredAt)}</td>
                  <td>{expense.description || <span className="muted">—</span>}</td>
                  <td className="numeric">{formatExpenseTotal(expense, currencyRates)}</td>
                  <td>{expense.currency}</td>
                  <td className="table__action" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="icon-button" aria-label={`Delete online shop expense ${expense.id}`} onClick={() => setDeleteTarget({ kind: 'expense', expense })}><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!expenses.data && expenses.loading && <p className="empty-state">Loading online shop expenses…</p>}
          {expenses.data?.total === 0 && <p className="empty-state">No Online Shop expenses match the selected filters.</p>}
        </div>
        {expenses.data && <Pagination page={expenses.data.page} totalPages={expenses.data.totalPages} onPageChange={setExpensesPage} />}
      </section>

      {formState?.kind === 'sale' && (
        <SaleFormModal
          sale={formState.mode === 'edit' ? formState.sale : undefined}
          onlineShop
          defaultMonth={month}
          onCancel={() => setFormState(null)}
          onSubmit={handleSaveSale}
        />
      )}
      {formState?.kind === 'expense' && (
        <ExpenseFormModal
          expense={formState.mode === 'edit' ? formState.expense : undefined}
          onlineShop
          defaultMonth={month}
          onCancel={() => setFormState(null)}
          onSubmit={handleSaveExpense}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={deleteTarget.kind === 'sale'
            ? `Delete online sale #${deleteTarget.sale.id}? Its items will be returned to inventory.`
            : deleteTarget.kind === 'expense'
              ? `Delete Online Shop expense #${deleteTarget.expense.id}?`
              : deleteTarget.kind === 'sales'
                ? `Delete ${deleteTarget.ids.length} selected online sale(s)? Their items will be returned to inventory.`
                : `Delete ${deleteTarget.ids.length} selected Online Shop expense(s)?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}

function formatSaleTotal(sale: Sale, rates: CurrencyRates | null) {
  const converted = rates ? convertCents(sale.totalCents, 'CAD', sale.currency, rates.cadPerUnit) : null;
  return converted === null ? '—' : formatCentsIn(converted, sale.currency);
}

function formatExpenseTotal(expense: Expense, rates: CurrencyRates | null) {
  const sourceTotal = expense.items.reduce((sum, item) => sum + item.sourceTotalCents, 0);
  if (expense.items.length > 0) return formatCentsIn(sourceTotal, expense.currency);
  const converted = rates ? convertCents(expense.totalCents, 'CAD', expense.currency, rates.cadPerUnit) : null;
  return converted === null ? '—' : formatCentsIn(converted, expense.currency);
}

function SummaryCard({
  label,
  value,
  tone = 'neutral',
  detail,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  detail?: string;
}) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value}</span>
      {detail && <span className="stat-card__detail">{detail}</span>}
    </div>
  );
}
