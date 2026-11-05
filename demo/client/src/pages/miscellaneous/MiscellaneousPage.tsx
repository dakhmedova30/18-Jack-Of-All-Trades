import { useEffect, useState } from 'react';
import { getMiscellaneousSummary } from '../../api/miscellaneous';
import { listChannels } from '../../api/channels';
import { bulkDeleteExpenses, createExpense, deleteExpense, updateExpense } from '../../api/expenses';
import { bulkDeleteSales, createSale, deleteSale, updateSale } from '../../api/sales';
import { getErrorMessage } from '../../api/http';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Pagination } from '../../components/Pagination';
import { PlusIcon, TrashIcon } from '../../components/icons';
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
  MiscellaneousSummary,
  Sale,
  SaleInput,
} from '../../types';
import { formatCentsIn } from '../../utils/money';

const MISC_TAG = 'misc';
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
  | { kind: 'bulk-sales'; ids: number[] }
  | { kind: 'bulk-expenses'; ids: number[] }
  | null;

export function MiscellaneousPage() {
  const { formatDate } = usePreferences();
  const { formatCad, rates, error: currencyError } = useReportingCurrency();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MiscellaneousSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryReload, setSummaryReload] = useState(0);
  const [salesPage, setSalesPage] = useState(1);
  const [expensesPage, setExpensesPage] = useState(1);
  const [salesSearchInput, setSalesSearchInput] = useState('');
  const salesSearch = useDebouncedValue(salesSearchInput.trim());
  const [expensesSearchInput, setExpensesSearchInput] = useState('');
  const expensesSearch = useDebouncedValue(expensesSearchInput.trim());
  const [salesFrom, setSalesFrom] = useState('');
  const [salesTo, setSalesTo] = useState('');
  const [expensesFrom, setExpensesFrom] = useState('');
  const [expensesTo, setExpensesTo] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [selectedSales, setSelectedSales] = useState<Set<number>>(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const miscChannel = channels?.find((channel) => channel.name.toLowerCase() === 'misc');
  const sales = useSales({
    page: salesPage,
    pageSize: PAGE_SIZE,
    sort: 'partyName',
    order: 'asc',
    search: salesSearch || undefined,
    currency: currencyFilter || undefined,
    from: salesFrom ? `${salesFrom}T00:00:00Z` : undefined,
    to: salesTo ? (() => {
      const date = new Date(`${salesTo}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toISOString();
    })() : undefined,
    channelId: miscChannel?.id ?? 0,
  });
  const expenses = useExpenses({
    page: expensesPage,
    pageSize: PAGE_SIZE,
    sort: 'partyName',
    order: 'asc',
    search: expensesSearch || undefined,
    currency: currencyFilter || undefined,
    from: expensesFrom ? `${expensesFrom}T00:00:00Z` : undefined,
    to: expensesTo ? (() => {
      const date = new Date(`${expensesTo}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toISOString();
    })() : undefined,
    tag: MISC_TAG,
  });

  useEffect(() => {
    let cancelled = false;
    listChannels()
      .then((result) => {
        if (!cancelled) setChannels(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setChannelError(getErrorMessage(reason));
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSummaryError(null);
    getMiscellaneousSummary()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setSummaryError(getErrorMessage(reason));
      });
    return () => { cancelled = true; };
  }, [summaryReload]);

  function reload() {
    sales.reload();
    expenses.reload();
    setSummaryReload((current) => current + 1);
  }

  async function saveSale(input: SaleInput) {
    if (formState?.kind === 'sale' && formState.mode === 'edit') {
      await updateSale(formState.sale.id, input);
    } else {
      await createSale(input);
    }
    setFormState(null);
    reload();
  }

  async function saveExpense(input: ExpenseInput) {
    if (formState?.kind === 'expense' && formState.mode === 'edit') {
      await updateExpense(formState.expense.id, input);
    } else {
      await createExpense(input);
    }
    setFormState(null);
    reload();
  }

  async function remove() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'sale') await deleteSale(deleteTarget.sale.id);
    else if (deleteTarget.kind === 'expense') await deleteExpense(deleteTarget.expense.id);
    else if (deleteTarget.kind === 'bulk-sales') await bulkDeleteSales(deleteTarget.ids);
    else await bulkDeleteExpenses(deleteTarget.ids);
    if (deleteTarget.kind === 'bulk-sales') setSelectedSales(new Set());
    if (deleteTarget.kind === 'bulk-expenses') setSelectedExpenses(new Set());
    setDeleteTarget(null);
    reload();
  }

  return (
    <section className="page feature-dashboard">
      <header className="feature-dashboard__header">
        <div>
          <h1>Miscellaneous</h1>
          <p className="muted">Record other sales and expenses by person. Sales update shared inventory and Analytics.</p>
        </div>
        <div className="feature-dashboard__actions">
          <button type="button" className="button button--secondary" onClick={() => setFormState({ kind: 'expense', mode: 'create' })}>
            Add expense <PlusIcon />
          </button>
          <button type="button" className="button" disabled={!miscChannel} onClick={() => setFormState({ kind: 'sale', mode: 'create' })}>
            Add sale <PlusIcon />
          </button>
        </div>
      </header>

      {channelError && <div className="banner banner--error" role="alert">Could not load sales channels: {channelError}</div>}
      {currencyError && <div className="banner banner--error" role="alert">Could not load currency rates: {currencyError}</div>}
      {channels && !miscChannel && <div className="banner banner--error" role="alert">The Misc sales channel is missing. Restore or rename a channel to “Misc” before recording sales.</div>}
      {summaryError && (
        <div className="banner banner--error" role="alert">
          Could not load miscellaneous totals: {summaryError}{' '}
          <button type="button" className="link-button" onClick={() => setSummaryReload((value) => value + 1)}>Retry</button>
        </div>
      )}

      <div className="market-summary feature-dashboard__stats">
        <SummaryCard label="Revenue" value={summary ? formatCad(summary.revenueCents) : '—'} />
        <SummaryCard label="Expenses" value={summary ? formatCad(summary.expensesCents) : '—'} />
        <SummaryCard label="Profit" value={summary ? formatCad(summary.profitCents) : '—'} negative={Boolean(summary && summary.profitCents < 0)} />
      </div>

      <section className="card feature-dashboard__records">
        <div className="feature-dashboard__section-heading"><div><h2>By person</h2><p className="muted">All-time revenue, expenses, and items sold.</p></div></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Person</th><th>Items</th><th className="numeric">Expenses</th><th className="numeric">Revenue</th><th className="numeric">Profit</th></tr></thead>
            <tbody>
              {summary?.people.map((person) => (
                <tr key={person.name}>
                  <td>{person.name}</td>
                  <td>{person.items.length > 0
                    ? person.items.map((item) => `${item.quantity} ${item.itemName}`).join(', ')
                    : <span className="muted">—</span>}</td>
                  <td className="numeric">{formatCad(person.expensesCents)}</td>
                  <td className="numeric">{formatCad(person.revenueCents)}</td>
                  <td className={`numeric${person.profitCents < 0 ? ' negative' : ''}`}>{formatCad(person.profitCents)}</td>
                </tr>
              ))}
            </tbody>
            {summary && summary.people.length > 0 && (
              <tfoot><tr><th colSpan={2}>Total</th><th className="numeric">{formatCad(summary.expensesCents)}</th><th className="numeric">{formatCad(summary.revenueCents)}</th><th className="numeric">{formatCad(summary.profitCents)}</th></tr></tfoot>
            )}
          </table>
          {!summary && !summaryError && <p className="empty-state">Loading miscellaneous totals…</p>}
          {summary && summary.people.length === 0 && <p className="empty-state">No miscellaneous records yet.</p>}
        </div>
      </section>

      <section className="card feature-dashboard__records">
        <div className="feature-dashboard__section-heading">
          <div><h2>Sales</h2><p className="muted">Sorted by person, then newest date. Free and trade lines still reduce inventory.</p></div>
          <button type="button" className="button button--secondary" disabled={!selectedSales.size} onClick={() => setDeleteTarget({ kind: 'bulk-sales', ids: [...selectedSales] })}>Bulk delete{selectedSales.size ? ` (${selectedSales.size})` : ''} <TrashIcon /></button>
        </div>
        <div className="toolbar__filters" aria-label="Filter miscellaneous sales">
          <label>Search<input type="search" value={salesSearchInput} onChange={(event) => { setSalesSearchInput(event.target.value); setSalesPage(1); }} /></label>
          <label>From<input type="date" value={salesFrom} onChange={(event) => { setSalesFrom(event.target.value); setSalesPage(1); }} /></label>
          <label>To<input type="date" value={salesTo} onChange={(event) => { setSalesTo(event.target.value); setSalesPage(1); }} /></label>
          <label>Currency<select value={currencyFilter} onChange={(event) => { setCurrencyFilter(event.target.value); setSalesPage(1); setExpensesPage(1); }}><option value="">All currencies</option>{(rates?.currencies ?? []).map(({ code, name }) => <option key={code} value={code}>{code} — {name}</option>)}</select></label>
          <span className="muted">Search covers IDs, person, date, tags, items, and currency.</span>
        </div>
        {sales.error && <div className="banner banner--error" role="alert">{sales.error} <button type="button" className="link-button" onClick={sales.reload}>Retry</button></div>}
        <div className={`table-wrap${sales.loading && sales.data ? ' is-loading' : ''}`}>
          <table className="table">
            <thead><tr><th className="table__check"><input type="checkbox" checked={Boolean(sales.data?.data.length) && sales.data?.data.every((sale) => selectedSales.has(sale.id))} onChange={() => setSelectedSales((current) => {
              const rows = sales.data?.data ?? [];
              const allSelected = rows.length > 0 && rows.every((sale) => current.has(sale.id));
              const next = new Set(current);
              rows.forEach((sale) => allSelected ? next.delete(sale.id) : next.add(sale.id));
              return next;
            })} aria-label="Select all miscellaneous sales on this page" /></th><th>ID</th><th>Person</th><th>Date</th><th>Items</th><th className="numeric">Total</th><th className="table__action">Delete</th></tr></thead>
            <tbody>
              {sales.data?.data.map((sale) => (
                <tr key={sale.id} className="table__row" tabIndex={0} aria-label={`Edit miscellaneous sale ${sale.id}`}
                  onClick={() => setFormState({ kind: 'sale', mode: 'edit', sale })}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setFormState({ kind: 'sale', mode: 'edit', sale });
                    }
                  }}>
                  <td className="table__check" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedSales.has(sale.id)} onChange={() => setSelectedSales((current) => {
                    const next = new Set(current);
                    if (next.has(sale.id)) next.delete(sale.id); else next.add(sale.id);
                    return next;
                  })} aria-label={`Select miscellaneous sale ${sale.id}`} /></td>
                  <td>{sale.id}</td>
                  <td>{sale.partyName || <span className="muted">Unspecified</span>}</td>
                  <td>{formatDate(sale.soldAt)}</td>
                  <td>{sale.items.map((item) => `${item.itemName} × ${item.quantity}${item.free ? ' (free)' : item.trade ? ' (trade)' : ''}`).join(', ')}</td>
                  <td className="numeric">{formatCad(sale.totalCents)}</td>
                  <td className="table__action" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="icon-button" aria-label={`Delete miscellaneous sale ${sale.id}`} onClick={() => setDeleteTarget({ kind: 'sale', sale })}><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.data && sales.loading && <p className="empty-state">Loading sales…</p>}
          {sales.data?.total === 0 && <p className="empty-state">No miscellaneous sales yet.</p>}
        </div>
        {sales.data && <Pagination page={sales.data.page} totalPages={sales.data.totalPages} onPageChange={setSalesPage} />}
      </section>

      <section className="card feature-dashboard__records">
        <div className="feature-dashboard__section-heading">
          <div><h2>Expenses</h2><p className="muted">Only expenses tagged Miscellaneous appear in these totals.</p></div>
          <button type="button" className="button button--secondary" disabled={!selectedExpenses.size} onClick={() => setDeleteTarget({ kind: 'bulk-expenses', ids: [...selectedExpenses] })}>Bulk delete{selectedExpenses.size ? ` (${selectedExpenses.size})` : ''} <TrashIcon /></button>
        </div>
        <div className="toolbar__filters" aria-label="Filter miscellaneous expenses">
          <label>Search<input type="search" value={expensesSearchInput} onChange={(event) => { setExpensesSearchInput(event.target.value); setExpensesPage(1); }} /></label>
          <label>From<input type="date" value={expensesFrom} onChange={(event) => { setExpensesFrom(event.target.value); setExpensesPage(1); }} /></label>
          <label>To<input type="date" value={expensesTo} onChange={(event) => { setExpensesTo(event.target.value); setExpensesPage(1); }} /></label>
          <label>Currency<select value={currencyFilter} onChange={(event) => { setCurrencyFilter(event.target.value); setSalesPage(1); setExpensesPage(1); }}><option value="">All currencies</option>{(rates?.currencies ?? []).map(({ code, name }) => <option key={code} value={code}>{code} — {name}</option>)}</select></label>
          <span className="muted">Search covers IDs, person, date, category, items, and currency.</span>
        </div>
        {expenses.error && <div className="banner banner--error" role="alert">{expenses.error} <button type="button" className="link-button" onClick={expenses.reload}>Retry</button></div>}
        <div className={`table-wrap${expenses.loading && expenses.data ? ' is-loading' : ''}`}>
          <table className="table">
            <thead><tr><th className="table__check"><input type="checkbox" checked={Boolean(expenses.data?.data.length) && expenses.data?.data.every((expense) => selectedExpenses.has(expense.id))} onChange={() => setSelectedExpenses((current) => {
              const rows = expenses.data?.data ?? [];
              const allSelected = rows.length > 0 && rows.every((expense) => current.has(expense.id));
              const next = new Set(current);
              rows.forEach((expense) => allSelected ? next.delete(expense.id) : next.add(expense.id));
              return next;
            })} aria-label="Select all miscellaneous expenses on this page" /></th><th>ID</th><th>Person</th><th>Date</th><th>Description</th><th className="numeric">Total</th><th className="table__action">Delete</th></tr></thead>
            <tbody>
              {expenses.data?.data.map((expense) => (
                <tr key={expense.id} className="table__row" tabIndex={0} aria-label={`Edit miscellaneous expense ${expense.id}`}
                  onClick={() => setFormState({ kind: 'expense', mode: 'edit', expense })}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setFormState({ kind: 'expense', mode: 'edit', expense });
                    }
                  }}>
                  <td className="table__check" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedExpenses.has(expense.id)} onChange={() => setSelectedExpenses((current) => {
                    const next = new Set(current);
                    if (next.has(expense.id)) next.delete(expense.id); else next.add(expense.id);
                    return next;
                  })} aria-label={`Select miscellaneous expense ${expense.id}`} /></td>
                  <td>{expense.id}</td>
                  <td>{expense.partyName || <span className="muted">Unspecified</span>}</td>
                  <td>{formatDate(expense.incurredAt)}</td>
                  <td>{expense.description || <span className="muted">—</span>}</td>
                  <td className="numeric">{formatCentsIn(expense.items.reduce((sum, item) => sum + item.sourceTotalCents, 0), expense.currency)}</td>
                  <td className="table__action" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="icon-button" aria-label={`Delete miscellaneous expense ${expense.id}`} onClick={() => setDeleteTarget({ kind: 'expense', expense })}><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!expenses.data && expenses.loading && <p className="empty-state">Loading expenses…</p>}
          {expenses.data?.total === 0 && <p className="empty-state">No miscellaneous expenses yet.</p>}
        </div>
        {expenses.data && <Pagination page={expenses.data.page} totalPages={expenses.data.totalPages} onPageChange={setExpensesPage} />}
      </section>

      {formState?.kind === 'sale' && (
        <SaleFormModal sale={formState.mode === 'edit' ? formState.sale : undefined} miscellaneous onCancel={() => setFormState(null)} onSubmit={saveSale} />
      )}
      {formState?.kind === 'expense' && (
        <ExpenseFormModal expense={formState.mode === 'edit' ? formState.expense : undefined} miscellaneous onCancel={() => setFormState(null)} onSubmit={saveExpense} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={deleteTarget.kind === 'sale'
            ? `Delete miscellaneous sale #${deleteTarget.sale.id}? Its items will be returned to inventory.`
            : deleteTarget.kind === 'expense'
              ? `Delete miscellaneous expense #${deleteTarget.expense.id}?`
              : `Delete ${deleteTarget.ids.length} selected miscellaneous ${deleteTarget.kind === 'bulk-sales' ? 'sale(s)' : 'expense(s)'}?`}
          onConfirm={remove}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}

function SummaryCard({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return <article className="summary-panel"><span>{label}</span><strong className={negative ? 'negative' : undefined}>{value}</strong></article>;
}
