import { useState } from 'react';
import { bulkDeleteSales, createSale, deleteSale, updateSale } from '../../api/sales';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useSalesMonthSummary } from '../../hooks/useSalesMonthSummary';
import { useSales } from '../../hooks/useSales';
import type { Sale, SaleInput, SaleSortField, SortOrder } from '../../types';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCents } from '../../utils/money';
import { BestSellersPanel } from './BestSellersPanel';
import { MonthGlancePanel } from './MonthGlancePanel';
import { SaleFormModal } from './SaleFormModal';

/** Table columns in order; those without a `field` aren't sortable. */
const COLUMNS: { field?: SaleSortField; label: string; numeric?: boolean }[] = [
  { field: 'id', label: 'ID' },
  { field: 'soldAt', label: 'Date' },
  { label: 'Description' },
  { field: 'total', label: 'Total', numeric: true },
  { field: 'channel', label: 'Channel' },
];
const DEFAULT_SORT: { field: SaleSortField; order: SortOrder } = { field: 'soldAt', order: 'desc' };

type FormState = { mode: 'create' } | { mode: 'edit'; sale: Sale } | null;
type DeleteTarget = { kind: 'single'; sale: Sale } | { kind: 'bulk'; ids: number[] } | null;

export function SalesPage() {
  const { preferences, formatDate } = usePreferences();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [sort, setSort] = useState(DEFAULT_SORT);
  const {
    data,
    error,
    loading,
    reload: reloadSales,
  } = useSales({
    page,
    pageSize: preferences.rowsPerPage,
    search,
    sort: sort.field,
    order: sort.order,
  });
  const insights = useInventoryInsights();
  const monthSummary = useSalesMonthSummary();

  // Any add/edit/delete can change this month's numbers, so refresh everything together.
  function reload() {
    reloadSales();
    insights.reload();
    monthSummary.reload();
  }

  /** Clicking the current sort column flips its direction; a new column starts ascending. */
  function toggleSort(field: SaleSortField) {
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

  const sales = data?.data ?? [];
  const allOnPageSelected = sales.length > 0 && sales.every((sale) => selectedIds.has(sale.id));

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
      for (const sale of sales) {
        if (allOnPageSelected) next.delete(sale.id);
        else next.add(sale.id);
      }
      return next;
    });
  }

  async function handleSave(input: SaleInput) {
    if (formState?.mode === 'edit') await updateSale(formState.sale.id, input);
    else await createSale(input);
    setFormState(null);
    reload();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.kind === 'single' ? [deleteTarget.sale.id] : deleteTarget.ids;

    if (deleteTarget.kind === 'single') await deleteSale(deleteTarget.sale.id);
    else await bulkDeleteSales(ids);

    setSelectedIds((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setDeleteTarget(null);

    // If we just emptied the last page, step back one page instead of showing nothing.
    const removedFromPage = sales.filter((sale) => ids.includes(sale.id)).length;
    if (page > 1 && removedFromPage === sales.length) {
      setPage(page - 1);
      insights.reload();
      monthSummary.reload();
    } else reload();
  }

  const isEmpty = data !== undefined && data.total === 0;

  return (
    <section className="page">
      <h1>Sales</h1>
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
          <label htmlFor="sales-search">Search</label>
          <div className="search">
            <input
              id="sales-search"
              type="search"
              placeholder="Search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
              aria-label="Search sales by description, channel or item"
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
                  aria-label="Select all sales on this page"
                />
              </th>
              {COLUMNS.map(({ field, label, numeric }) => {
                if (!field) return <th key={label}>{label}</th>;
                const active = sort.field === field;
                return (
                  <th
                    key={field}
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
                );
              })}
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr
                key={sale.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit sale ${sale.id}`}
                onClick={() => setFormState({ mode: 'edit', sale })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ mode: 'edit', sale });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(sale.id)}
                    onChange={() => toggleSelected(sale.id)}
                    aria-label={`Select sale ${sale.id}`}
                  />
                </td>
                <td>{sale.id}</td>
                <td>{formatDate(sale.soldAt)}</td>
                <td className="table__description" title={sale.description}>
                  {sale.description || <span className="muted">—</span>}
                </td>
                <td className="numeric">{formatCents(sale.totalCents)}</td>
                <td>{sale.channel?.name ?? <span className="muted">—</span>}</td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete sale ${sale.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'single', sale });
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
            <p>Add a new sale into the table</p>
            <button
              type="button"
              className="button"
              onClick={() => setFormState({ mode: 'create' })}
            >
              Add <PlusIcon />
            </button>
          </div>
        )}
        {isEmpty && search && <p className="empty-state">No sales match “{search}”.</p>}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      <div className="panel-row">
        <MonthGlancePanel {...monthSummary} />
        <BestSellersPanel {...insights} />
      </div>

      {formState && (
        <SaleFormModal
          sale={formState.mode === 'edit' ? formState.sale : undefined}
          onCancel={() => setFormState(null)}
          onSubmit={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'single'
              ? `Do you want to delete sale #${deleteTarget.sale.id}? This restores its items to stock.`
              : `Do you want to delete ${deleteTarget.ids.length} selected sale(s)? This restores their items to stock.`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
