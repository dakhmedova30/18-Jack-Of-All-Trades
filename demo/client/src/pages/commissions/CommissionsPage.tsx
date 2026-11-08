import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bulkDeleteCommissions,
  bulkDeleteUnassignedCommissionExpenses,
  createCommission,
  deleteCommission,
  deleteUnassignedCommissionExpense,
  listCommissions,
  listUnassignedCommissionExpenses,
  updateCommission,
} from '../../api/commissions';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { TagList } from '../../components/TagList';
import { useCurrency } from '../../hooks/useCurrency';
import { useLoad } from '../../hooks/useLoad';
import { usePreferences } from '../../hooks/usePreferences';
import type { Commission, CommissionExpense, CommissionInput } from '../../types';
import { formatCents } from '../../utils/money';
import { CommissionFormModal } from './CommissionFormModal';

type FormState = { kind: 'create' } | { kind: 'edit'; commission: Commission } | null;
type DeleteTarget = { kind: 'commissions'; commissions: Commission[] } | { kind: 'expenses'; expenses: CommissionExpense[] } | null;

export function CommissionsPage() {
  const { data, error, loading, reload } = useLoad(listCommissions);
  const orphanedExpenses = useLoad(listUnassignedCommissionExpenses);
  const { formatDate } = usePreferences();
  const accountCurrency = useCurrency();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectedOrphanExpenses, setSelectedOrphanExpenses] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const commissions = data ?? [];
  const detachedExpenses = orphanedExpenses.data ?? [];
  const allSelected = commissions.length > 0 && commissions.every((commission) => selected.has(commission.id));
  const knownTags = [...new Set(commissions.flatMap((commission) => commission.tags))];
  const currency = commissions[0]?.currency ?? accountCurrency;
  const totals = commissions.reduce(
    (acc, commission) => ({
      sales: acc.sales + commission.salesCount,
      expenses: acc.expenses + commission.expensesCents,
      revenue: acc.revenue + commission.revenueCents,
      profit: acc.profit + commission.profitCents,
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

  async function save(input: CommissionInput) {
    if (formState?.kind === 'edit') await updateCommission(formState.commission.id, input);
    else await createCommission(input);
    setFormState(null);
    reload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'commissions') {
      const ids = deleteTarget.commissions.map((commission) => commission.id);
      if (ids.length === 1) await deleteCommission(ids[0]);
      else await bulkDeleteCommissions(ids);
      setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    } else {
      const ids = deleteTarget.expenses.map((expense) => expense.id);
      if (ids.length === 1) await deleteUnassignedCommissionExpense(ids[0]);
      else await bulkDeleteUnassignedCommissionExpenses(ids);
      setSelectedOrphanExpenses((current) =>
        new Set([...current].filter((id) => !ids.includes(id))),
      );
    }
    setDeleteTarget(null);
    reload();
    orphanedExpenses.reload();
  }

  return (
    <section className="page">
      <div>
        <h1>Commissions</h1>
        <p className="muted">Track requests, deadlines, itemized sales and expenses for each commission.</p>
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
                kind: 'commissions',
                commissions: commissions.filter((commission) => selected.has(commission.id)),
              })
            }
          >
            Bulk delete{selected.size > 0 && ` (${selected.size})`} <TrashIcon />
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
                    setSelected(allSelected ? new Set() : new Set(commissions.map((entry) => entry.id)))
                  }
                  aria-label="Select all commissions"
                />
              </th>
              <th>ID</th>
              <th>Name</th>
              <th>Contact</th>
              <th>Request</th>
              <th>Deadline</th>
              <th>Tags</th>
              <th className="numeric">Sales</th>
              <th className="numeric">Expenses</th>
              <th className="numeric">Revenue</th>
              <th className="numeric">Profit</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((commission) => (
              <tr
                key={commission.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit ${commission.name}`}
                onClick={() => setFormState({ kind: 'edit', commission })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ kind: 'edit', commission });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(commission.id)}
                    onChange={() => toggle(commission.id)}
                    aria-label={`Select ${commission.name}`}
                  />
                </td>
                <td>{commission.id}</td>
                <td>
                  <Link
                    to={`/sales/commissions/${commission.id}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {commission.name}
                  </Link>
                </td>
                <td>{commission.contact || <span className="muted">—</span>}</td>
                <td className="table__description" title={commission.request}>
                  {commission.request || <span className="muted">—</span>}
                </td>
                <td>{formatDate(commission.deadline)}</td>
                <td>
                  <TagList tags={commission.tags} />
                </td>
                <td className="numeric">{commission.salesCount}</td>
                <td className="numeric">{formatCents(commission.expensesCents, commission.currency)}</td>
                <td className="numeric">{formatCents(commission.revenueCents, commission.currency)}</td>
                <td className="numeric">{formatCents(commission.profitCents, commission.currency)}</td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${commission.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'commissions', commissions: [commission] });
                    }}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {commissions.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={7}>
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
        {data && commissions.length === 0 && (
          <div className="empty-state">
            <p>Add your first commission to start tracking requests, sales and expenses</p>
            <button type="button" className="button" onClick={() => setFormState({ kind: 'create' })}>
              Add <PlusIcon />
            </button>
          </div>
        )}
      </div>
      {detachedExpenses.length > 0 && (
        <section>
          <h2>Detached commission expenses</h2>
          <p className="muted">
            These expenses were kept when their commission was deleted. They are no longer included in a
            commission total.
          </p>
          <div className="toolbar">
            <button
              type="button"
              className="button button--secondary"
              disabled={selectedOrphanExpenses.size === 0}
              onClick={() =>
                setDeleteTarget({
                  kind: 'expenses',
                  expenses: detachedExpenses.filter((expense) => selectedOrphanExpenses.has(expense.id)),
                })
              }
            >
              Delete detached expenses{selectedOrphanExpenses.size > 0 && ` (${selectedOrphanExpenses.size})`}{' '}
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
                        detachedExpenses.every((expense) => selectedOrphanExpenses.has(expense.id))
                      }
                      onChange={() =>
                        setSelectedOrphanExpenses(
                          detachedExpenses.every((expense) => selectedOrphanExpenses.has(expense.id))
                            ? new Set()
                            : new Set(detachedExpenses.map((expense) => expense.id)),
                        )
                      }
                      aria-label="Select all detached expenses"
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
                        checked={selectedOrphanExpenses.has(expense.id)}
                        onChange={() =>
                          setSelectedOrphanExpenses((current) => {
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
        <CommissionFormModal
          commission={formState.kind === 'edit' ? formState.commission : undefined}
          knownTags={knownTags}
          onCancel={() => setFormState(null)}
          onSubmit={save}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'commissions'
              ? `Delete ${deleteTarget.commissions.length} commission(s)? Linked sales and expenses will be kept and detached.`
              : `Delete ${deleteTarget.expenses.length} detached commission expense(s)?`
          }
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
