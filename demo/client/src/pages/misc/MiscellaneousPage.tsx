import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bulkDeleteMiscellaneous,
  bulkDeleteUnassignedMiscExpenses,
  createMiscellaneous,
  deleteMiscellaneous,
  deleteUnassignedMiscExpense,
  listMiscellaneous,
  listUnassignedMiscExpenses,
  updateMiscellaneous,
} from '../../api/miscellaneous';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { TagList } from '../../components/TagList';
import { useLoad } from '../../hooks/useLoad';
import { usePreferences } from '../../hooks/usePreferences';
import type { MiscExpense, MiscellaneousInput, MiscellaneousRecord } from '../../types';
import { formatCents } from '../../utils/money';
import { MiscellaneousFormModal } from './MiscellaneousFormModal';

type FormState = { kind: 'create' } | { kind: 'edit'; record: MiscellaneousRecord } | null;
type DeleteTarget =
  | { kind: 'records'; records: MiscellaneousRecord[] }
  | { kind: 'expenses'; expenses: MiscExpense[] }
  | null;

export function MiscellaneousPage() {
  const { data, error, loading, reload } = useLoad(listMiscellaneous);
  const unassigned = useLoad(listUnassignedMiscExpenses);
  const { formatDate } = usePreferences();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const records = data ?? [];
  const detachedExpenses = unassigned.data ?? [];
  const allSelected = records.length > 0 && records.every((record) => selected.has(record.id));
  const knownTags = [...new Set(records.flatMap((record) => record.tags))];
  const currency = records[0]?.currency ?? 'CAD';
  const totals = records.reduce(
    (acc, record) => ({
      sales: acc.sales + record.salesCount,
      expenses: acc.expenses + record.expensesCents,
      revenue: acc.revenue + record.revenueCents,
      profit: acc.profit + record.profitCents,
    }),
    { sales: 0, expenses: 0, revenue: 0, profit: 0 },
  );

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(input: MiscellaneousInput) {
    if (formState?.kind === 'edit') await updateMiscellaneous(formState.record.id, input);
    else await createMiscellaneous(input);
    setFormState(null);
    reload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'records') {
      const ids = deleteTarget.records.map((record) => record.id);
      if (ids.length === 1) await deleteMiscellaneous(ids[0]);
      else await bulkDeleteMiscellaneous(ids);
      setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
      reload();
      unassigned.reload();
    } else {
      const ids = deleteTarget.expenses.map((expense) => expense.id);
      if (ids.length === 1) await deleteUnassignedMiscExpense(ids[0]);
      else await bulkDeleteUnassignedMiscExpenses(ids);
      setSelectedExpenses((current) => new Set([...current].filter((id) => !ids.includes(id))));
      unassigned.reload();
    }
    setDeleteTarget(null);
  }

  return (
    <section className="page">
      <div>
        <h1>Miscellaneous</h1>
        <p className="muted">
          Group itemized sales, discounts and expenses that don’t belong to a market, online shop or commission.
        </p>
      </div>
      <div className="toolbar">
        <div className="toolbar__actions">
          <button type="button" className="button" onClick={() => setFormState({ kind: 'create' })}>
            Add <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selected.size === 0}
            onClick={() =>
              setDeleteTarget({
                kind: 'records',
                records: records.filter((record) => selected.has(record.id)),
              })
            }
          >
            Bulk Delete{selected.size > 0 && ` (${selected.size})`} <TrashIcon />
          </button>
        </div>
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
                    setSelected(allSelected ? new Set() : new Set(records.map((record) => record.id)))
                  }
                  aria-label="Select all miscellaneous records"
                />
              </th>
              <th>ID</th>
              <th>Name</th>
              <th>Date</th>
              <th>Tags</th>
              <th className="numeric">Sales</th>
              <th className="numeric">Expenses</th>
              <th className="numeric">Revenue</th>
              <th className="numeric">Profit</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit ${record.name}`}
                onClick={() => setFormState({ kind: 'edit', record })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ kind: 'edit', record });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(record.id)}
                    onChange={() => toggle(record.id)}
                    aria-label={`Select ${record.name}`}
                  />
                </td>
                <td>{record.id}</td>
                <td>
                  <Link to={`/sales/misc/${record.id}`} onClick={(event) => event.stopPropagation()}>
                    {record.name}
                  </Link>
                </td>
                <td>{formatDate(record.receivedOn)}</td>
                <td>
                  <TagList tags={record.tags} />
                </td>
                <td className="numeric">{record.salesCount}</td>
                <td className="numeric">{formatCents(record.expensesCents, record.currency)}</td>
                <td className="numeric">{formatCents(record.revenueCents, record.currency)}</td>
                <td className="numeric">{formatCents(record.profitCents, record.currency)}</td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${record.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'records', records: [record] });
                    }}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {records.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={5}>
                  Total ({currency})
                </th>
                <td className="numeric">{totals.sales}</td>
                <td className="numeric">{formatCents(totals.expenses, currency)}</td>
                <td className="numeric">{formatCents(totals.revenue, currency)}</td>
                <td className="numeric">{formatCents(totals.profit, currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {!data && loading && <p className="empty-state">Loading…</p>}
        {data && records.length === 0 && (
          <div className="empty-state">
            <p>Add a miscellaneous group to track its sales and expenses</p>
            <button type="button" className="button" onClick={() => setFormState({ kind: 'create' })}>
              Add <PlusIcon />
            </button>
          </div>
        )}
      </div>
      {detachedExpenses.length > 0 && (
        <section>
          <h2>Detached miscellaneous expenses</h2>
          <p className="muted">These expenses remain after their group was deleted and aren’t included in totals.</p>
          <div className="toolbar">
            <button
              type="button"
              className="button button--secondary"
              disabled={selectedExpenses.size === 0}
              onClick={() =>
                setDeleteTarget({
                  kind: 'expenses',
                  expenses: detachedExpenses.filter((expense) => selectedExpenses.has(expense.id)),
                })
              }
            >
              Delete detached expenses{selectedExpenses.size > 0 && ` (${selectedExpenses.size})`}{' '}
              <TrashIcon />
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="table__check">
                    <input
                      type="checkbox"
                      checked={
                        detachedExpenses.length > 0 &&
                        detachedExpenses.every((expense) => selectedExpenses.has(expense.id))
                      }
                      onChange={() =>
                        setSelectedExpenses(
                          detachedExpenses.every((expense) => selectedExpenses.has(expense.id))
                            ? new Set()
                            : new Set(detachedExpenses.map((expense) => expense.id)),
                        )
                      }
                      aria-label="Select all detached miscellaneous expenses"
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
                {detachedExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="table__check">
                      <input
                        type="checkbox"
                        checked={selectedExpenses.has(expense.id)}
                        onChange={() =>
                          setSelectedExpenses((current) => {
                            const next = new Set(current);
                            if (next.has(expense.id)) next.delete(expense.id);
                            else next.add(expense.id);
                            return next;
                          })
                        }
                        aria-label={`Select detached expense ${expense.id}`}
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
                        aria-label={`Delete detached expense ${expense.id}`}
                        onClick={() => setDeleteTarget({ kind: 'expenses', expenses: [expense] })}
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {formState && (
        <MiscellaneousFormModal
          record={formState.kind === 'edit' ? formState.record : undefined}
          knownTags={knownTags}
          onCancel={() => setFormState(null)}
          onSubmit={save}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'records'
              ? `Delete ${deleteTarget.records.length} miscellaneous group(s)? Linked sales and expenses will be kept and detached.`
              : `Delete ${deleteTarget.expenses.length} detached miscellaneous expense(s)?`
          }
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
