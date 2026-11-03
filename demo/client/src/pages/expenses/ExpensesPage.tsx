import { Fragment, useState } from 'react';
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
import { useExpenseMonthBreakdown } from '../../hooks/useExpenseMonthBreakdown';
import { useExpenses } from '../../hooks/useExpenses';
import type { Expense, ExpenseInput, ExpenseSortField, SortOrder } from '../../types';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCents } from '../../utils/money';
import { ExpenseFormModal } from './ExpenseFormModal';
import { MoneyBreakdownPanel } from './MoneyBreakdownPanel';
import { TopRestockPanel } from './TopRestockPanel';

const SORTABLE_COLUMNS: { field: ExpenseSortField; label: string; numeric?: boolean }[] = [
  { field: 'id', label: 'ID' },
  { field: 'incurredAt', label: 'Date' },
  { field: 'total', label: 'Total', numeric: true },
  { field: 'tags', label: 'Tags' },
];
const LINES_NAMED_PER_EXPENSE = 2;

/** "Studio rent, flower pot ×10 +1 more": each line's description (or restocked
 *  item's name), the first few named and the rest counted. */
function describeExpenseLines(expense: Expense): string {
  const named = expense.items
    .slice(0, LINES_NAMED_PER_EXPENSE)
    .map((line) => (line.quantity > 1 ? `${line.itemName} ×${line.quantity}` : line.itemName))
    .join(', ');
  const remaining = expense.items.length - LINES_NAMED_PER_EXPENSE;
  return remaining > 0 ? `${named} +${remaining} more` : named;
}

const DEFAULT_SORT: { field: ExpenseSortField; order: SortOrder } = {
  field: 'incurredAt',
  order: 'desc',
};

type FormState = { mode: 'create' } | { mode: 'edit'; expense: Expense } | null;
type DeleteTarget = { kind: 'single'; expense: Expense } | { kind: 'bulk'; ids: number[] } | null;

export function ExpensesPage() {
  const { preferences, formatDate } = usePreferences();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [sort, setSort] = useState(DEFAULT_SORT);
  const {
    data,
    error,
    loading,
    reload: reloadExpenses,
  } = useExpenses({
    page,
    pageSize: preferences.rowsPerPage,
    search,
    sort: sort.field,
    order: sort.order,
  });

  const breakdown = useExpenseMonthBreakdown();

  // Any add/edit/delete can change this month's split, so refresh both together.
  function reload() {
    reloadExpenses();
    breakdown.reload();
  }

  /** Clicking the current sort column flips its direction; a new column starts ascending. */
  function toggleSort(field: ExpenseSortField) {
    setSort((current) =>
      current.field === field
        ? { field, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { field, order: 'asc' },
    );
    setPage(1);
  }

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
    if (page > 1 && removedFromPage === expenses.length) {
      setPage(page - 1);
      breakdown.reload();
    } else reload();
  }

  const isEmpty = data !== undefined && data.total === 0;

  return (
    <section className="page">
      <h1>Expenses</h1>
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
        <div className="search-field">
          <label htmlFor="expenses-search">Search</label>
          <div className="search">
            <input
              id="expenses-search"
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
          </div>
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
                  checked={allOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                  aria-label="Select all expenses on this page"
                />
              </th>
              {SORTABLE_COLUMNS.map(({ field, label, numeric }) => {
                const active = sort.field === field;
                return (
                  <Fragment key={field}>
                    <th
                      className={numeric ? 'numeric' : undefined}
                      aria-sort={
                        active ? (sort.order === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <button
                        type="button"
                        className={`sort-button${active ? ' is-active' : ''}`}
                        onClick={() => toggleSort(field)}
                      >
                        {label}
                        <span className="sort-button__arrow" aria-hidden="true">
                          {active ? (sort.order === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                    {/* Description sits between Date and Total; it isn't sortable. */}
                    {field === 'incurredAt' && <th>Description</th>}
                  </Fragment>
                );
              })}
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr
                key={expense.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit expense ${expense.id}`}
                onClick={() => setFormState({ mode: 'edit', expense })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ mode: 'edit', expense });
                  }
                }}
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
                <td className="expense-description">{describeExpenseLines(expense)}</td>
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

      <div className="panel-row">
        <MoneyBreakdownPanel {...breakdown} />
        <TopRestockPanel {...breakdown} />
      </div>

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
