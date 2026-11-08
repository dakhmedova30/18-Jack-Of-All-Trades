import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listChannels } from '../../api/channels';
import {
  bulkDeleteOnlineExpenses,
  createOnlineExpense,
  deleteOnlineExpense,
  listOnlineExpenses,
  listOnlineMonths,
  updateOnlineExpense,
} from '../../api/onlineShop';
import { bulkDeleteSales, createSale, deleteSale, listSales, updateSale } from '../../api/sales';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { TagList } from '../../components/TagList';
import { useCurrency } from '../../hooks/useCurrency';
import { useLoad } from '../../hooks/useLoad';
import { usePreferences } from '../../hooks/usePreferences';
import type {
  CurrencyCode,
  OnlineExpense,
  OnlineExpenseInput,
  Sale,
  SaleInput,
} from '../../types';
import { formatCents } from '../../utils/money';
import { describeSale, saleTotal } from '../markets/MarketDetailPage';
import { MarketSaleFormModal } from '../markets/MarketSaleFormModal';
import { OnlineExpenseFormModal } from './OnlineExpenseFormModal';
import { formatMonth } from './OnlineShopPage';

type FormState = { kind: 'sale'; sale?: Sale } | { kind: 'expense'; expense?: OnlineExpense } | null;
type DeleteTarget =
  | { kind: 'sale'; ids: number[] }
  | { kind: 'expense'; ids: number[] }
  | null;

function lastDayOf(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}

function toggle(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function OnlineMonthPage() {
  const month = useParams().month ?? '';
  const currency = useCurrency() as CurrencyCode;
  const { formatDate } = usePreferences();
  const channels = useLoad(listChannels);
  const onlineChannelId = channels.data?.find((c) => c.name.toLowerCase() === 'online')?.id;
  const summary = useLoad(() => listOnlineMonths(currency), [currency]);
  const sales = useLoad(
    () =>
      onlineChannelId === undefined
        ? Promise.resolve(null)
        : listSales({
            page: 1,
            pageSize: 100,
            channelId: onlineChannelId,
            from: `${month}-01`,
            to: lastDayOf(month),
            sort: 'soldAt',
            order: 'asc',
          }),
    [month, onlineChannelId],
  );
  const expenses = useLoad(() => listOnlineExpenses(month), [month]);
  const allExpenses = useLoad(() => listOnlineExpenses());
  const [selectedSales, setSelectedSales] = useState<Set<number>>(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const saleRows = (sales.data?.data ?? []).filter((sale) => sale.marketId === null);
  const expenseRows = expenses.data ?? [];
  const info = summary.data?.find((entry) => entry.month === month);
  const knownTags = [...new Set((allExpenses.data ?? []).flatMap((expense) => expense.tags))];
  const firstOfMonth = `${month}-01`;
  const error = summary.error ?? sales.error ?? expenses.error;

  function reloadAll() {
    summary.reload();
    sales.reload();
    expenses.reload();
    allExpenses.reload();
  }

  async function handleSaveSale(input: SaleInput) {
    if (formState?.kind === 'sale' && formState.sale) await updateSale(formState.sale.id, input);
    else await createSale(input);
    setFormState(null);
    reloadAll();
  }

  async function handleSaveExpense(input: OnlineExpenseInput) {
    if (formState?.kind === 'expense' && formState.expense) {
      await updateOnlineExpense(formState.expense.id, input);
    } else {
      await createOnlineExpense(input);
    }
    setFormState(null);
    reloadAll();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const { kind, ids } = deleteTarget;
    if (kind === 'sale') {
      if (ids.length === 1) await deleteSale(ids[0]);
      else await bulkDeleteSales(ids);
      setSelectedSales((current) => new Set([...current].filter((id) => !ids.includes(id))));
    } else {
      if (ids.length === 1) await deleteOnlineExpense(ids[0]);
      else await bulkDeleteOnlineExpenses(ids);
      setSelectedExpenses((current) => new Set([...current].filter((id) => !ids.includes(id))));
    }
    setDeleteTarget(null);
    reloadAll();
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return (
      <section className="page">
        <div className="banner banner--error" role="alert">
          That month isn’t valid.
        </div>
        <Link to="/sales/online">Back to Online Shop</Link>
      </section>
    );
  }

  const allSalesSelected = saleRows.length > 0 && saleRows.every((sale) => selectedSales.has(sale.id));
  const allExpensesSelected =
    expenseRows.length > 0 && expenseRows.every((expense) => selectedExpenses.has(expense.id));

  return (
    <section className="page">
      <div>
        <p>
          <Link to="/sales/online">← Online Shop</Link>
        </p>
        <h1>{formatMonth(month)}</h1>
        <p className="muted">Amounts are shown in {currency}.</p>
      </div>

      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar__actions">
          <button
            type="button"
            className="button"
            disabled={onlineChannelId === undefined}
            onClick={() => setFormState({ kind: 'sale' })}
          >
            Add sale <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selectedSales.size === 0}
            onClick={() => setDeleteTarget({ kind: 'sale', ids: [...selectedSales] })}
          >
            Bulk delete sales{selectedSales.size > 0 && ` (${selectedSales.size})`} <TrashIcon />
          </button>
        </div>
      </div>

      <div className={`table-wrap${sales.loading && sales.data ? ' is-loading' : ''}`}>
        <table className="table">
          <caption>Sales</caption>
          <thead>
            <tr>
              <th className="table__check">
                <input
                  type="checkbox"
                  checked={allSalesSelected}
                  onChange={() =>
                    setSelectedSales(allSalesSelected ? new Set() : new Set(saleRows.map((s) => s.id)))
                  }
                  aria-label="Select all sales"
                />
              </th>
              <th>ID</th>
              <th>Date</th>
              <th>Items</th>
              <th>Tags</th>
              <th className="numeric">Total</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {saleRows.map((sale) => (
              <tr
                key={sale.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit sale ${sale.id}`}
                onClick={() => setFormState({ kind: 'sale', sale })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ kind: 'sale', sale });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedSales.has(sale.id)}
                    onChange={() => setSelectedSales((current) => toggle(current, sale.id))}
                    aria-label={`Select sale ${sale.id}`}
                  />
                </td>
                <td>{sale.id}</td>
                <td>{formatDate(sale.soldAt)}</td>
                <td className="table__description" title={describeSale(sale)}>
                  {describeSale(sale)}
                </td>
                <td>
                  <TagList tags={sale.tags} />
                </td>
                <td className="numeric">{formatCents(saleTotal(sale), sale.originalCurrency)}</td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete sale ${sale.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'sale', ids: [sale.id] });
                    }}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {info && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={5}>
                  Total revenue ({info.salesCount} sales)
                </th>
                <td className="numeric">{formatCents(info.revenueCents, info.currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {sales.data && saleRows.length === 0 && (
          <p className="empty-state">No online sales this month</p>
        )}
      </div>

      <div className="toolbar">
        <div className="toolbar__actions">
          <button type="button" className="button" onClick={() => setFormState({ kind: 'expense' })}>
            Add expense <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selectedExpenses.size === 0}
            onClick={() => setDeleteTarget({ kind: 'expense', ids: [...selectedExpenses] })}
          >
            Bulk delete expenses{selectedExpenses.size > 0 && ` (${selectedExpenses.size})`}{' '}
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className={`table-wrap${expenses.loading && expenses.data ? ' is-loading' : ''}`}>
        <table className="table">
          <caption>Expenses</caption>
          <thead>
            <tr>
              <th className="table__check">
                <input
                  type="checkbox"
                  checked={allExpensesSelected}
                  onChange={() =>
                    setSelectedExpenses(
                      allExpensesSelected ? new Set() : new Set(expenseRows.map((e) => e.id)),
                    )
                  }
                  aria-label="Select all expenses"
                />
              </th>
              <th>ID</th>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Tags</th>
              <th>Currency</th>
              <th className="numeric">Amount</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {expenseRows.map((expense) => (
              <tr
                key={expense.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit expense ${expense.id}`}
                onClick={() => setFormState({ kind: 'expense', expense })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ kind: 'expense', expense });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedExpenses.has(expense.id)}
                    onChange={() => setSelectedExpenses((current) => toggle(current, expense.id))}
                    aria-label={`Select expense ${expense.id}`}
                  />
                </td>
                <td>{expense.id}</td>
                <td>{formatDate(expense.spentOn)}</td>
                <td>{expense.description || <span className="muted">—</span>}</td>
                <td>{expense.category || <span className="muted">—</span>}</td>
                <td>
                  <TagList tags={expense.tags} />
                </td>
                <td>{expense.currency}</td>
                <td className="numeric">{formatCents(expense.amountCents, expense.currency)}</td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete expense ${expense.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'expense', ids: [expense.id] });
                    }}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {info && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={7}>
                  Total expenses
                </th>
                <td className="numeric">{formatCents(info.expensesCents, info.currency)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row" colSpan={7}>
                  Profit
                </th>
                <td className="numeric">{formatCents(info.profitCents, info.currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {expenses.data && expenseRows.length === 0 && (
          <p className="empty-state">No online expenses this month</p>
        )}
      </div>

      {formState?.kind === 'sale' && (
        <MarketSaleFormModal
          target={{
            marketId: null,
            commissionId: null,
            miscId: null,
            channelName: 'online',
            title: 'Add online sale',
            currency,
            defaultDate: firstOfMonth,
          }}
          sale={formState.sale}
          onCancel={() => setFormState(null)}
          onSubmit={handleSaveSale}
        />
      )}
      {formState?.kind === 'expense' && (
        <OnlineExpenseFormModal
          expense={formState.expense}
          defaultDate={firstOfMonth}
          knownTags={knownTags}
          onCancel={() => setFormState(null)}
          onSubmit={handleSaveExpense}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'sale'
              ? `Do you want to delete ${deleteTarget.ids.length} sale(s)? The items sold return to stock.`
              : `Do you want to delete ${deleteTarget.ids.length} expense(s)?`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
