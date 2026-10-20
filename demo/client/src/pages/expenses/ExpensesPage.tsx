import { useState } from 'react';
import {
  bulkDeleteExpenses,
  createExpense,
  deleteExpense,
  updateExpense,
} from '../../api/expenses';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { TagList } from '../../components/TagList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useExpenses } from '../../hooks/useExpenses';
import type { Expense, ExpenseInput } from '../../types';
import { formatDate } from '../../utils/date';
import { formatCents } from '../../utils/money';
import { ExpenseFormModal } from './ExpenseFormModal';

const PAGE_SIZE = 10;

type FormState = { mode: 'create' } | { mode: 'edit'; expense: Expense } | null;
type DeleteTarget = { kind: 'single'; expense: Expense } | { kind: 'bulk'; ids: number[] } | null;

export function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const { data, error, loading, reload } = useExpenses({ page, pageSize: PAGE_SIZE, search });

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const expenses = data?.data ?? [];
  const allOnPageSelected =
    expenses.length > 0 && expenses.every((expense) => selectedIds.has(expense.id));

  function toggleSelected(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const expense of expenses) {
        if (allOnPageSelected) next.delete(expense.id);
        else next.add(expense.id);
      }
      return next;
    });
  }

  async function handleSave(input: ExpenseInput) {
    if (formState?.mode === 'edit') await updateExpense(formState.expense.id, input);
    else await createExpense(input);
    setFormState(null);
    reload();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.kind === 'single' ? [deleteTarget.expense.id] : deleteTarget.ids;

    if (deleteTarget.kind === 'single') await deleteExpense(deleteTarget.expense.id);
    else await bulkDeleteExpenses(ids);

    setSelectedIds((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setDeleteTarget(null);

    // If we just emptied the last page, step back one page instead of showing nothing.
    const removedFromPage = expenses.filter((expense) => ids.includes(expense.id)).length;
    if (page > 1 && removedFromPage === expenses.length) setPage(page - 1);
    else reload();
  }

  const isEmpty = data !== undefined && data.total === 0;

  return (
    <section className="page">
      <div className="toolbar">
        <div className="toolbar__actions">
          <button type="button" className="button" onClick={() => setFormState({ mode: 'create' })}>
            Add <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selectedIds.size === 0}
            onClick={() => setDeleteTarget({ kind: 'bulk', ids: [...selectedIds] })}
          >
            Bulk delete{selectedIds.size > 0 && ` (${selectedIds.size})`} <TrashIcon />
          </button>
        </div>
        <label className="search">
          <input
            type="search"
            placeholder="Search"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
            aria-label="Search expenses by tag or item"
          />
          <SearchIcon />
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
                  checked={allOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                  aria-label="Select all expenses on this page"
                />
              </th>
              <th>ID</th>
              <th>Date</th>
              <th className="numeric">Total</th>
              <th>Tags</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr
                key={expense.id}
                className="table__row"
                onClick={() => setFormState({ mode: 'edit', expense })}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(expense.id)}
                    onChange={() => toggleSelected(expense.id)}
                    aria-label={`Select expense ${expense.id}`}
                  />
                </td>
                <td>{expense.id}</td>
                <td>{formatDate(expense.incurredAt)}</td>
                <td className="numeric">{formatCents(expense.totalCents)}</td>
                <td>
                  <TagList tags={expense.tags} />
                </td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete expense ${expense.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'single', expense });
                    }}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!data && loading && <p className="empty-state">Loading…</p>}
        {isEmpty && !search && (
          <div className="empty-state">
            <p>Add a new expense into the table</p>
            <button
              type="button"
              className="button"
              onClick={() => setFormState({ mode: 'create' })}
            >
              Add <PlusIcon />
            </button>
          </div>
        )}
        {isEmpty && search && <p className="empty-state">No expenses match “{search}”.</p>}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {formState && (
        <ExpenseFormModal
          expense={formState.mode === 'edit' ? formState.expense : undefined}
          onCancel={() => setFormState(null)}
          onSubmit={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'single'
              ? `Do you want to delete expense #${deleteTarget.expense.id}? Any restock it made will be undone.`
              : `Do you want to delete ${deleteTarget.ids.length} selected expense(s)? Any restock they made will be undone.`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
