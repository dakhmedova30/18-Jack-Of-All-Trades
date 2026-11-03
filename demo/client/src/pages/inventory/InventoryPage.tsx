import { useState } from 'react';
import { bulkDeleteItems, createItem, deleteItem, updateItem } from '../../api/items';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { TagList } from '../../components/TagList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useItems } from '../../hooks/useItems';
import { usePreferences } from '../../hooks/usePreferences';
import { useLowStock } from '../../hooks/useLowStock';
import type {
  InventoryInsights,
  Item,
  ItemInput,
  ItemSortField,
  LowStock,
  SortOrder,
} from '../../types';
import { formatCents } from '../../utils/money';
import { ItemFormModal } from './ItemFormModal';

/** The server's max; enough to list every low item for any realistic shop. */
const LOW_STOCK_LIST_LIMIT = 100;

const SORTABLE_COLUMNS: { field: ItemSortField; label: string; numeric?: boolean }[] = [
  { field: 'id', label: 'ID' },
  { field: 'name', label: 'Name' },
  { field: 'quantity', label: 'Qty', numeric: true },
  { field: 'unitPriceCents', label: 'Unit price', numeric: true },
];

type FormState = { mode: 'create' } | { mode: 'edit'; item: Item } | null;
type DeleteTarget = { kind: 'single'; item: Item } | { kind: 'bulk'; ids: number[] } | null;

export function InventoryPage() {
  const { preferences } = usePreferences();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<{ field: ItemSortField; order: SortOrder }>({
    field: 'id',
    order: 'asc',
  });
  const search = useDebouncedValue(searchInput.trim());
  const {
    data,
    error,
    loading,
    reload: reloadItems,
  } = useItems({
    page,
    pageSize: preferences.rowsPerPage,
    search,
    sort: sort.field,
    order: sort.order,
  });
  const lowStock = useLowStock(LOW_STOCK_LIST_LIMIT);
  const insights = useInventoryInsights();

  // Any add/edit/delete can change what's low and what stock is worth, so refresh all together.
  function reload() {
    reloadItems();
    lowStock.reload();
    insights.reload();
  }

  /** Clicking the current sort column flips its direction; a new column starts ascending. */
  function toggleSort(field: ItemSortField) {
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

  const items = data?.data ?? [];
  const allOnPageSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

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
      for (const item of items) {
        if (allOnPageSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  async function handleSave(input: ItemInput) {
    if (formState?.mode === 'edit') await updateItem(formState.item.id, input);
    else await createItem(input);
    setFormState(null);
    reload();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.kind === 'single' ? [deleteTarget.item.id] : deleteTarget.ids;

    if (deleteTarget.kind === 'single') await deleteItem(deleteTarget.item.id);
    else await bulkDeleteItems(ids);

    setSelectedIds((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setDeleteTarget(null);

    // If we just emptied the last page, step back one page instead of showing nothing.
    const removedFromPage = items.filter((item) => ids.includes(item.id)).length;
    if (page > 1 && removedFromPage === items.length) {
      setPage(page - 1);
      lowStock.reload();
      insights.reload();
    } else reload();
  }

  const isEmpty = data !== undefined && data.total === 0;

  return (
    <section className="page">
      <h1>Inventory</h1>
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
          <label htmlFor="inventory-search">Search</label>
          <div className="search">
            <input
              id="inventory-search"
              type="search"
              placeholder="Search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
              aria-label="Search items by name or tag"
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
                  aria-label="Select all items on this page"
                />
              </th>
              {SORTABLE_COLUMNS.map(({ field, label, numeric }) => {
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
              <th>Tags</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit ${item.name}`}
                onClick={() => setFormState({ mode: 'edit', item })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ mode: 'edit', item });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    aria-label={`Select ${item.name}`}
                  />
                </td>
                <td>{item.id}</td>
                <td>{item.name}</td>
                <td className="numeric">{item.quantity}</td>
                <td className="numeric">{formatCents(item.unitPriceCents)}</td>
                <td>
                  <TagList tags={item.tags} />
                </td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${item.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'single', item });
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
            <p>Add a new item into the table</p>
            <button
              type="button"
              className="button"
              onClick={() => setFormState({ mode: 'create' })}
            >
              Add <PlusIcon />
            </button>
          </div>
        )}
        {isEmpty && search && <p className="empty-state">No items match “{search}”.</p>}
      </div>

      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      <div className="panel-row">
        <StockValuePanel {...insights} />
        <LowStockPanel {...lowStock} />
      </div>

      {formState && (
        <ItemFormModal
          item={formState.mode === 'edit' ? formState.item : undefined}
          onCancel={() => setFormState(null)}
          onSubmit={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'single'
              ? `Do you want to delete “${deleteTarget.item.name}”?`
              : `Do you want to delete ${deleteTarget.ids.length} selected item(s)?`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}

interface LowStockPanelProps {
  data?: LowStock;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** Every item at or below the low-stock threshold, lowest first, in a scrollable list. */
function LowStockPanel({ data, error, loading, reload }: LowStockPanelProps) {
  return (
    <div className="card low-stock">
      <div className="low-stock__header">
        <h2>Low stock{data ? ` (${data.count})` : ''}</h2>
        {data && <span className="muted">{data.threshold} or fewer in stock</span>}
      </div>
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load low stock: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : data.count === 0 ? (
        <p className="empty-state">Nothing is low on stock.</p>
      ) : (
        <>
          <ul className="low-stock__list">
            {data.items.map((item) => (
              <li key={item.id} className="low-stock__row">
                <span className="low-stock__name">{item.name}</span>
                <span className={`low-stock__qty${item.quantity === 0 ? ' is-out' : ''}`}>
                  {item.quantity === 0 ? 'Out of stock' : `${item.quantity} left`}
                </span>
              </li>
            ))}
          </ul>
          {data.count > data.items.length && (
            <p className="muted">
              Showing the {data.items.length} lowest of {data.count}.
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface StockValuePanelProps {
  data?: InventoryInsights;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** What everything in stock is worth at selling price, next to Low stock. */
function StockValuePanel({ data, error, loading, reload }: StockValuePanelProps) {
  return (
    <div className="card low-stock">
      <div className="low-stock__header">
        <h2>Stock value</h2>
        <span className="muted">at selling price</span>
      </div>
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load stock value: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : (
        <div className="stock-value">
          <span className="stock-value__amount">{formatCents(data.stockValueCents)}</span>
          <span className="muted">{data.totalUnits.toLocaleString()} units in stock</span>
        </div>
      )}
    </div>
  );
}
