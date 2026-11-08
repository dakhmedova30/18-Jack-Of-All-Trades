import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createOnlineExpense,
  deleteOnlineMonths,
  listOnlineExpenses,
  listOnlineMonths,
} from '../../api/onlineShop';
import { createSale } from '../../api/sales';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { useCurrency } from '../../hooks/useCurrency';
import { useLoad } from '../../hooks/useLoad';
import { CURRENCY_CODES, type CurrencyCode, type OnlineExpenseInput, type SaleInput } from '../../types';
import { formatCents } from '../../utils/money';
import { MarketSaleFormModal } from '../markets/MarketSaleFormModal';
import { OnlineExpenseFormModal } from './OnlineExpenseFormModal';

export function formatMonth(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

type FormState = 'sale' | 'expense' | null;

export function OnlineShopPage() {
  const businessCurrency = useCurrency() as CurrencyCode;
  const [currency, setCurrency] = useState<CurrencyCode>(businessCurrency);
  const { data, error, loading, reload } = useLoad(() => listOnlineMonths(currency), [currency]);
  const expenses = useLoad(() => listOnlineExpenses());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteMonths, setDeleteMonths] = useState<string[] | null>(null);

  const months = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const allSelected = months.length > 0 && months.every((entry) => selected.has(entry.month));
  const knownTags = [...new Set((expenses.data ?? []).flatMap((expense) => expense.tags))];

  const totals = months.reduce(
    (acc, m) => ({
      sales: acc.sales + m.salesCount,
      expenses: acc.expenses + m.expensesCents,
      revenue: acc.revenue + m.revenueCents,
      profit: acc.profit + m.profitCents,
    }),
    { sales: 0, expenses: 0, revenue: 0, profit: 0 },
  );
  const perSale = totals.sales > 0 ? Math.round(totals.revenue / totals.sales) : 0;

  function toggleSelected(month: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  function reloadAll() {
    reload();
    expenses.reload();
  }

  async function handleSaveSale(input: SaleInput) {
    await createSale(input);
    setFormState(null);
    reloadAll();
  }

  async function handleSaveExpense(input: OnlineExpenseInput) {
    await createOnlineExpense(input);
    setFormState(null);
    reloadAll();
  }

  async function handleConfirmDelete() {
    if (!deleteMonths) return;
    await deleteOnlineMonths(deleteMonths);
    setSelected((current) => new Set([...current].filter((month) => !deleteMonths.includes(month))));
    setDeleteMonths(null);
    reloadAll();
  }

  return (
    <section className="page">
      <div>
        <h1>Online Shop</h1>
        <p className="muted">
          Months are built from your Online sales and expenses. Open a month to see or change them.
        </p>
      </div>

      <div className="toolbar">
        <div className="toolbar__actions">
          <button type="button" className="button" onClick={() => setFormState('sale')}>
            Add sale <PlusIcon />
          </button>
          <button type="button" className="button" onClick={() => setFormState('expense')}>
            Add expense <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selected.size === 0}
            onClick={() => setDeleteMonths([...selected])}
          >
            Bulk delete{selected.size > 0 && ` (${selected.size})`} <TrashIcon />
          </button>
        </div>
        <label className="toolbar__field">
          Show amounts in{' '}
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            aria-label="Display currency"
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      <div className={`table-wrap${loading && data ? ' is-loading' : ''}`}>
        <table className="table">
          <thead>
            <tr>
              <th className="table__check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(months.map((entry) => entry.month)))
                  }
                  aria-label="Select all months"
                />
              </th>
              <th>Month</th>
              <th className="numeric">Sales</th>
              <th className="numeric">Expenses</th>
              <th className="numeric">Revenue</th>
              <th className="numeric">Profit</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {months.map((entry) => (
              <tr key={entry.month}>
                <td className="table__check">
                  <input
                    type="checkbox"
                    checked={selected.has(entry.month)}
                    onChange={() => toggleSelected(entry.month)}
                    aria-label={`Select ${formatMonth(entry.month)}`}
                  />
                </td>
                <td>
                  <Link to={`/sales/online/${entry.month}`}>{formatMonth(entry.month)}</Link>
                </td>
                <td className="numeric">{entry.salesCount}</td>
                <td className="numeric">{formatCents(entry.expensesCents, entry.currency)}</td>
                <td className="numeric">{formatCents(entry.revenueCents, entry.currency)}</td>
                <td className="numeric">{formatCents(entry.profitCents, entry.currency)}</td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${formatMonth(entry.month)}`}
                    onClick={() => setDeleteMonths([entry.month])}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {months.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  Total ({currency})
                </th>
                <td className="numeric">{totals.sales}</td>
                <td className="numeric">{formatCents(totals.expenses, currency)}</td>
                <td className="numeric">{formatCents(totals.revenue, currency)}</td>
                <td className="numeric">{formatCents(totals.profit, currency)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row" colSpan={5}>
                  Revenue per sale
                </th>
                <td className="numeric">{formatCents(perSale, currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>

        {!data && loading && <p className="empty-state">Loading…</p>}
        {data && months.length === 0 && (
          <div className="empty-state">
            <p>Add a sale or an expense to start your first month</p>
          </div>
        )}
      </div>

      {formState === 'sale' && (
        <MarketSaleFormModal
          target={{
            marketId: null,
            commissionId: null,
            channelName: 'online',
            title: 'Add online sale',
            currency,
            defaultDate: today,
          }}
          onCancel={() => setFormState(null)}
          onSubmit={handleSaveSale}
        />
      )}
      {formState === 'expense' && (
        <OnlineExpenseFormModal
          defaultDate={today}
          knownTags={knownTags}
          onCancel={() => setFormState(null)}
          onSubmit={handleSaveExpense}
        />
      )}

      {deleteMonths && (
        <ConfirmDialog
          title="Delete confirmation"
          message={`Do you want to delete ${deleteMonths.length} selected month(s)? All their online sales and expenses are deleted too, and the items sold return to stock.`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteMonths(null)}
        />
      )}
    </section>
  );
}
