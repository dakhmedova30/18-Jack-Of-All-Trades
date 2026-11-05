import { useEffect, useState } from 'react';
import { listChannels } from '../../api/channels';
import { deleteExpense, updateExpense, createExpense } from '../../api/expenses';
import { deleteSale, updateSale, createSale } from '../../api/sales';
import { getOnlineShopMonthlySummary } from '../../api/onlineShop';
import { getErrorMessage } from '../../api/http';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Pagination } from '../../components/Pagination';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { useExpenses } from '../../hooks/useExpenses';
import { useSales } from '../../hooks/useSales';
import { usePreferences } from '../../hooks/usePreferences';
import { ExpenseFormModal } from '../expenses/ExpenseFormModal';
import { SaleFormModal } from '../sales/SaleFormModal';
import type {
  Channel,
  Expense,
  ExpenseInput,
  OnlineShopSummary,
  Sale,
  SaleInput,
} from '../../types';
import { formatCents } from '../../utils/money';

const ONLINE_SHOP_TAG = 'online shop';
const PAGE_SIZE = 10;

type FormState =
  | { kind: 'sale'; mode: 'create' }
  | { kind: 'sale'; mode: 'edit'; sale: Sale }
  | { kind: 'expense'; mode: 'create' }
  | { kind: 'expense'; mode: 'edit'; expense: Expense }
  | null;
type DeleteTarget = { kind: 'sale'; sale: Sale } | { kind: 'expense'; expense: Expense } | null;

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
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
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

  const onlineChannel = channels?.find((channel) => channel.name.toLowerCase() === 'online');
  const { from, to } = monthRange(month);
  const sales = useSales({
    page: salesPage,
    pageSize: PAGE_SIZE,
    sort: 'soldAt',
    order: 'desc',
    channelId: onlineChannel?.id ?? 0,
    from,
    to,
  });
  const expenses = useExpenses({
    page: expensesPage,
    pageSize: PAGE_SIZE,
    sort: 'incurredAt',
    order: 'desc',
    tag: ONLINE_SHOP_TAG,
    from,
    to,
  });

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
    else await deleteExpense(deleteTarget.expense.id);
    setDeleteTarget(null);
    reload();
  }

  function changeMonth(value: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
    setMonth(value);
    setSalesPage(1);
    setExpensesPage(1);
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
        <SummaryCard label="Net revenue" value={summary ? formatCents(summary.revenueCents) : summaryLoading ? '…' : '—'} />
        <SummaryCard label="Expenses" value={summary ? formatCents(summary.expenseCents) : summaryLoading ? '…' : '—'} />
        <SummaryCard
          label="Profit"
          value={summary ? formatCents(summary.profitCents) : summaryLoading ? '…' : '—'}
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
          <button
            type="button"
            className="button"
            disabled={!onlineChannel}
            onClick={() => setFormState({ kind: 'sale', mode: 'create' })}
          >
            Add sale <PlusIcon />
          </button>
        </div>
        {sales.error && <div className="banner banner--error" role="alert">{sales.error} <button type="button" className="link-button" onClick={sales.reload}>Retry</button></div>}
        <div className={`table-wrap${sales.loading && sales.data ? ' is-loading' : ''}`}>
          <table className="table">
            <thead><tr><th>Date</th><th>Description</th><th className="numeric">Net received</th><th className="table__action">Delete</th></tr></thead>
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
                  <td>{formatDate(sale.soldAt)}</td>
                  <td>{sale.description || <span className="muted">—</span>}</td>
                  <td className="numeric">{formatCents(sale.totalCents)}</td>
                  <td className="table__action" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="icon-button" aria-label={`Delete online sale ${sale.id}`} onClick={() => setDeleteTarget({ kind: 'sale', sale })}><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.data && sales.loading && <p className="empty-state">Loading online sales…</p>}
          {sales.data?.total === 0 && <p className="empty-state">No online sales for this month.</p>}
        </div>
        {sales.data && <Pagination page={sales.data.page} totalPages={sales.data.totalPages} onPageChange={setSalesPage} />}
      </section>

      <section className="card online-shop__records">
        <div className="online-shop__section-heading">
          <div><h2>Expenses</h2><p className="muted">Only expenses tagged Online Shop are included in these totals.</p></div>
          <button type="button" className="button" onClick={() => setFormState({ kind: 'expense', mode: 'create' })}>
            Add expense <PlusIcon />
          </button>
        </div>
        {expenses.error && <div className="banner banner--error" role="alert">{expenses.error} <button type="button" className="link-button" onClick={expenses.reload}>Retry</button></div>}
        <div className={`table-wrap${expenses.loading && expenses.data ? ' is-loading' : ''}`}>
          <table className="table">
            <thead><tr><th>Date</th><th>Description</th><th className="numeric">Total</th><th className="table__action">Delete</th></tr></thead>
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
                  <td>{formatDate(expense.incurredAt)}</td>
                  <td>{expense.description || <span className="muted">—</span>}</td>
                  <td className="numeric">{formatCents(expense.totalCents)}</td>
                  <td className="table__action" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="icon-button" aria-label={`Delete online shop expense ${expense.id}`} onClick={() => setDeleteTarget({ kind: 'expense', expense })}><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!expenses.data && expenses.loading && <p className="empty-state">Loading online shop expenses…</p>}
          {expenses.data?.total === 0 && <p className="empty-state">No Online Shop expenses for this month.</p>}
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
            : `Delete Online Shop expense #${deleteTarget.expense.id}?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
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
