import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  bulkDeleteMiscExpenses,
  createMiscExpense,
  deleteMiscExpense,
  getMiscellaneous,
  listMiscExpenses,
  updateMiscExpense,
} from '../../api/miscellaneous';
import { listChannels } from '../../api/channels';
import { bulkDeleteSales, createSale, deleteSale, listSales, updateSale } from '../../api/sales';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { TagList } from '../../components/TagList';
import { useLoad } from '../../hooks/useLoad';
import { usePreferences } from '../../hooks/usePreferences';
import type { MiscExpense, OnlineExpenseInput, Sale, SaleInput } from '../../types';
import { formatCents } from '../../utils/money';
import { describeSale, saleTotal } from '../markets/MarketDetailPage';
import { MarketSaleFormModal } from '../markets/MarketSaleFormModal';
import { OnlineExpenseFormModal } from '../online/OnlineExpenseFormModal';

type FormState =
  | { kind: 'sale'; sale?: Sale }
  | { kind: 'expense'; expense?: MiscExpense }
  | null;
type DeleteTarget =
  | { kind: 'sales'; ids: number[] }
  | { kind: 'expenses'; ids: number[] }
  | null;

function toggle(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function MiscellaneousDetailPage() {
  const miscId = Number(useParams().miscId);
  const { formatDate } = usePreferences();
  const record = useLoad(() => getMiscellaneous(miscId), [miscId]);
  const channels = useLoad(listChannels);
  const sales = useLoad(
    () => listSales({ page: 1, pageSize: 100, miscId, sort: 'soldAt', order: 'asc' }),
    [miscId],
  );
  const expenses = useLoad(() => listMiscExpenses(miscId), [miscId]);
  const [selectedSales, setSelectedSales] = useState<Set<number>>(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const info = record.data;
  const saleRows = (sales.data?.data ?? []).filter((sale) => sale.miscId === miscId);
  const expenseRows = expenses.data ?? [];
  const knownTags = [...new Set(expenseRows.flatMap((expense) => expense.tags))];
  const currency = info?.currency ?? 'CAD';
  const error = record.error ?? sales.error ?? expenses.error;
  const miscChannelId = channels.data?.find((channel) => channel.name.toLowerCase() === 'misc')?.id;

  function reloadAll() {
    record.reload();
    sales.reload();
    expenses.reload();
  }

  async function saveSale(input: SaleInput) {
    if (formState?.kind === 'sale' && formState.sale) await updateSale(formState.sale.id, input);
    else await createSale(input);
    setFormState(null);
    reloadAll();
  }

  async function saveExpense(input: OnlineExpenseInput) {
    if (formState?.kind === 'expense' && formState.expense) {
      await updateMiscExpense(miscId, formState.expense.id, input);
    } else {
      await createMiscExpense(miscId, input);
    }
    setFormState(null);
    reloadAll();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'sales') {
      if (deleteTarget.ids.length === 1) await deleteSale(deleteTarget.ids[0]);
      else await bulkDeleteSales(deleteTarget.ids);
      setSelectedSales((current) => new Set([...current].filter((id) => !deleteTarget.ids.includes(id))));
    } else {
      if (deleteTarget.ids.length === 1) await deleteMiscExpense(miscId, deleteTarget.ids[0]);
      else await bulkDeleteMiscExpenses(miscId, deleteTarget.ids);
      setSelectedExpenses((current) => new Set([...current].filter((id) => !deleteTarget.ids.includes(id))));
    }
    setDeleteTarget(null);
    reloadAll();
  }

  if (!Number.isInteger(miscId) || miscId < 1) {
    return (
      <section className="page">
        <div className="banner banner--error" role="alert">
          That miscellaneous ID isn’t valid.
        </div>
        <Link to="/sales/misc">Back to Miscellaneous</Link>
      </section>
    );
  }
  if (error && !info) {
    return (
      <section className="page">
        <div className="banner banner--error" role="alert">
          {error}
        </div>
        <Link to="/sales/misc">Back to Miscellaneous</Link>
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
          <Link to="/sales/misc">← Miscellaneous</Link>
        </p>
        <h1>{info?.name ?? 'Miscellaneous'}</h1>
        {info && (
          <>
            <p className="muted">Date {formatDate(info.receivedOn)}</p>
            <TagList tags={info.tags} />
          </>
        )}
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
            disabled={miscChannelId === undefined}
            onClick={() => setFormState({ kind: 'sale' })}
          >
            Add Sale <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selectedSales.size === 0}
            onClick={() => setDeleteTarget({ kind: 'sales', ids: [...selectedSales] })}
          >
            Bulk Delete Sales{selectedSales.size > 0 && ` (${selectedSales.size})`} <TrashIcon />
          </button>
        </div>
      </div>
      <div className={`table-wrap${sales.loading && sales.data ? ' is-loading' : ''}`}>
        <table className="table">
          <caption>Sales and items</caption>
          <thead>
            <tr>
              <th className="table__check">
                <input
                  type="checkbox"
                  checked={allSalesSelected}
                  onChange={() =>
                    setSelectedSales(allSalesSelected ? new Set() : new Set(saleRows.map((sale) => sale.id)))
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
                      setDeleteTarget({ kind: 'sales', ids: [sale.id] });
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
                <td className="numeric">{formatCents(info.revenueCents, currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {sales.data && saleRows.length === 0 && <p className="empty-state">No miscellaneous sales yet</p>}
      </div>

      <div className="toolbar">
        <div className="toolbar__actions">
          <button type="button" className="button" onClick={() => setFormState({ kind: 'expense' })}>
            Add Expense <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selectedExpenses.size === 0}
            onClick={() => setDeleteTarget({ kind: 'expenses', ids: [...selectedExpenses] })}
          >
            Bulk Delete Expenses{selectedExpenses.size > 0 && ` (${selectedExpenses.size})`}{' '}
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
                      allExpensesSelected ? new Set() : new Set(expenseRows.map((expense) => expense.id)),
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
                      setDeleteTarget({ kind: 'expenses', ids: [expense.id] });
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
                  Expenses
                </th>
                <td className="numeric">{formatCents(info.expensesCents, currency)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row" colSpan={7}>
                  Profit
                </th>
                <td className="numeric">{formatCents(info.profitCents, currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {expenses.data && expenseRows.length === 0 && <p className="empty-state">No miscellaneous expenses yet</p>}
      </div>
      {formState?.kind === 'sale' && (
        <MarketSaleFormModal
          target={{
            marketId: null,
            commissionId: null,
            miscId,
            channelName: 'misc',
            title: `Add sale to ${info?.name ?? 'miscellaneous group'}`,
            currency,
            defaultDate: new Date().toISOString().slice(0, 10),
          }}
          sale={formState.sale}
          onCancel={() => setFormState(null)}
          onSubmit={saveSale}
        />
      )}
      {formState?.kind === 'expense' && (
        <OnlineExpenseFormModal
          expense={formState.expense}
          defaultDate={new Date().toISOString().slice(0, 10)}
          knownTags={knownTags}
          onCancel={() => setFormState(null)}
          onSubmit={saveExpense}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'sales'
              ? `Delete ${deleteTarget.ids.length} sale(s)? Sold items return to stock.`
              : `Delete ${deleteTarget.ids.length} miscellaneous expense(s)?`
          }
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
