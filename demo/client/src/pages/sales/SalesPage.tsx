import { useState } from 'react';
import { bulkDeleteSales, createSale, deleteSale, listSales, updateSale } from '../../api/sales';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CsvTransfer } from '../../components/CsvTransfer';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useSalesMonthSummary } from '../../hooks/useSalesMonthSummary';
import { useSales } from '../../hooks/useSales';
import { useCurrency } from '../../hooks/useCurrency';
import type { Sale, SaleInput, SaleSortField, SortOrder } from '../../types';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCents } from '../../utils/money';
import { fetchAllPages } from '../../utils/csv';
import {
  csvId,
  saleCsvRow,
  saleInputFromCsv,
  upsertFromCsv,
  SALE_CSV_HEADERS,
  SALE_IMPORT_HEADERS,
} from '../../utils/businessCsv';
import { BestSellersPanel } from './BestSellersPanel';
import { MonthGlancePanel } from './MonthGlancePanel';
import { SaleFormModal } from './SaleFormModal';
import {
  canApplySaleFilters,
  hasSaleFilters,
  NO_SALE_FILTERS,
  SalesFilters,
  type SaleFilterValues,
} from './SalesFilters';

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
  const currency = useCurrency();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [filters, setFilters] = useState<SaleFilterValues>(NO_SALE_FILTERS);
  // Typed dates change on every keystroke. Filter the table once they settle, and only by values
  // that make sense; until then it keeps the last good filters, so no request is wasted.
  const settledFilters = useDebouncedValue(filters);
  const [applied, setApplied] = useState<SaleFilterValues>(NO_SALE_FILTERS);
  if (settledFilters !== applied && canApplySaleFilters(settledFilters)) {
    setApplied(settledFilters);
  }
  const filtered = hasSaleFilters(applied);
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
    channelId: applied.channelId ? Number(applied.channelId) : undefined,
    from: applied.from || undefined,
    to: applied.to || undefined,
  });
  const insights = useInventoryInsights();
  const monthSummary = useSalesMonthSummary();

  // Any add/edit/delete can change this month's numbers, so refresh everything together.
  function reload() {
    reloadSales();
    insights.reload();
    monthSummary.reload();
  }

  async function importSale(record: Record<string, string>) {
    const id = csvId(record);
    const input = saleInputFromCsv(record);
    return upsertFromCsv(
      id,
      (existingId) => updateSale(existingId, input),
      () => createSale(input),
    );
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

  function changeFilters(next: SaleFilterValues) {
    setFilters(next);
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
      <div>
        <h1>Sales</h1>
        <p className="muted">A recap of sales made over the chosen date range.</p>
      </div>

      <div className="panel-row">
        <MonthGlancePanel {...monthSummary} />
        <BestSellersPanel {...insights} />
      </div>
      <div className="toolbar">
        <div className="toolbar__actions">
          <CsvTransfer
            filename="sales"
            headers={SALE_CSV_HEADERS}
            loadRows={() => fetchAllPages((requestedPage, pageSize) =>
              listSales({ page: requestedPage, pageSize }),
            )}
            exportRow={saleCsvRow}
            importHeaders={SALE_IMPORT_HEADERS}
            importRow={importSale}
            onImported={reload}
          />
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
        <div className="toolbar__filters">
          <SalesFilters value={filters} onChange={changeFilters} />
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
                <td className="numeric">{formatCents(sale.totalCents, currency)}</td>
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
        {isEmpty && !search && !filtered && (
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
        {isEmpty && (search || filtered) && (
          <div className="empty-state">
            <p>
              {search ? `No sales match “${search}”` : 'No sales match these filters'}
              {search && filtered && ' with these filters'}.
            </p>
            {filtered && (
              <button
                type="button"
                className="link-button"
                onClick={() => changeFilters(NO_SALE_FILTERS)}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

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
