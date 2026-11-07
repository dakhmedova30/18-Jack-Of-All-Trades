import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '../../api/http';
import {
  bulkDeleteItems,
  bulkSetItemsPublic,
  createItem,
  deleteItem,
  listItems,
  updateItem,
} from '../../api/items';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CsvTransfer } from '../../components/CsvTransfer';
import { SummaryPanel } from '../../components/SummaryPanel';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { TagList } from '../../components/TagList';
import { useAuth } from '../../hooks/useAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useInventoryInsights } from '../../hooks/useInventoryInsights';
import { useItems } from '../../hooks/useItems';
import { usePreferences } from '../../hooks/usePreferences';
import { useLowStock } from '../../hooks/useLowStock';
import { useCurrency } from '../../hooks/useCurrency';
import type {
  InventoryInsights,
  Item,
  ItemInput,
  ItemSortField,
  LowStock,
  SortOrder,
} from '../../types';
import { formatCents } from '../../utils/money';
import { fetchAllPages } from '../../utils/csv';
import {
  csvId,
  itemCsvRow,
  itemInputFromCsv,
  upsertFromCsv,
  ITEM_CSV_HEADERS,
  ITEM_IMPORT_HEADERS,
} from '../../utils/businessCsv';
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

/** What the last bulk show/hide did, shown under the toolbar. */
type VisibilityResult = { message: string; profileOff: boolean } | { error: string } | null;

/** A bulk show/hide waiting for confirmation, because some selected items already have that status. */
type VisibilityTarget = { isPublic: boolean; change: Item[]; skipped: Item[] } | null;

/** How many names a confirmation lists before "and N more". */
const MAX_LISTED_NAMES = 5;

function itemCount(count: number): string {
  return count === 1 ? '1 item' : `${count} items`;
}

/** “Ring”, “Necklace” and 3 more */
function listNames(items: Item[]): string {
  const names = items.slice(0, MAX_LISTED_NAMES).map((item) => `“${item.name}”`);
  const rest = items.length - names.length;
  if (rest > 0) return `${names.join(', ')} and ${rest} more`;
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
}

/** Why a mixed selection is asked about: which items keep their status. */
function skippedMessage({ isPublic, change, skipped }: NonNullable<VisibilityTarget>): string {
  const one = skipped.length === 1;
  const where = isPublic ? 'already on' : 'already hidden from';
  return (
    `${listNames(skipped)} ${one ? 'is' : 'are'} ${where} your public profile, so ` +
    `${one ? 'it stays as it is' : 'they stay as they are'}. ` +
    `${isPublic ? 'Show' : 'Hide'} the other ${itemCount(change.length)}?`
  );
}

export function InventoryPage() {
  const { preferences } = usePreferences();
  const { business } = useAuth();
  const currency = useCurrency();
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

  async function importItem(record: Record<string, string>) {
    const id = csvId(record);
    const input = itemInputFromCsv(record);
    return upsertFromCsv(
      id,
      (existingId) => updateItem(existingId, input),
      () => createItem(input),
    );
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

  // Selected items by id, as they were when selected; the selection can span pages.
  const [selected, setSelected] = useState<Map<number, Item>>(new Map());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityResult, setVisibilityResult] = useState<VisibilityResult>(null);
  const [visibilityTarget, setVisibilityTarget] = useState<VisibilityTarget>(null);

  const items = data?.data ?? [];
  const allOnPageSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  // An item on the page just loaded is fresher than its copy from when it was selected.
  const pageItems = new Map(items.map((item) => [item.id, item]));
  const selectedItems = [...selected.values()].map((item) => pageItems.get(item.id) ?? item);
  const toShow = selectedItems.filter((item) => !item.isPublic);
  const toHide = selectedItems.filter((item) => item.isPublic);

  function toggleSelected(item: Item) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelected((current) => {
      const next = new Map(current);
      for (const item of items) {
        if (allOnPageSelected) next.delete(item.id);
        else next.set(item.id, item);
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

    setSelected((current) => {
      const next = new Map(current);
      for (const id of ids) next.delete(id);
      return next;
    });
    setDeleteTarget(null);

    // If we just emptied the last page, step back one page instead of showing nothing.
    const removedFromPage = items.filter((item) => ids.includes(item.id)).length;
    if (page > 1 && removedFromPage === items.length) {
      setPage(page - 1);
      lowStock.reload();
      insights.reload();
    } else reload();
  }

  /** Sends only the items that change; throws on failure, so the caller shows the error. */
  async function applyVisibility(isPublic: boolean, change: Item[]) {
    const { updated } = await bulkSetItemsPublic(
      change.map((item) => item.id),
      isPublic,
    );
    setVisibilityResult({
      message: isPublic
        ? `${itemCount(updated)} now on your public profile.`
        : `${itemCount(updated)} hidden from your public profile.`,
      profileOff: isPublic && !business?.publicSlug,
    });
    setSelected(new Map());
    setVisibilityTarget(null);
    reloadItems();
  }

  /**
   * Shows or hides the selected items. If some already have that status, asks first and lists
   * them; otherwise it's easy to undo, so it just happens.
   */
  async function setSelectedPublic(isPublic: boolean) {
    const change = isPublic ? toShow : toHide;
    const skipped = isPublic ? toHide : toShow;
    setVisibilityResult(null);
    if (skipped.length > 0) {
      setVisibilityTarget({ isPublic, change, skipped });
      return;
    }
    setVisibilityBusy(true);
    try {
      await applyVisibility(isPublic, change);
    } catch (err) {
      setVisibilityResult({ error: getErrorMessage(err) });
    } finally {
      setVisibilityBusy(false);
    }
  }

  const isEmpty = data !== undefined && data.total === 0;

  return (
    <section className="page">
      <div>
        <h1>Inventory</h1>
        <p className="muted">A view of your current inventory.</p>
      </div>

      <div className="panel-row">
        <StockValuePanel {...insights} />
        <LowStockPanel {...lowStock} />
        <NotSellingPanel {...insights} />
      </div>
      <div className="toolbar">
        <div className="toolbar__actions">
          <CsvTransfer
            filename="inventory"
            headers={ITEM_CSV_HEADERS}
            loadRows={() =>
              fetchAllPages((requestedPage, pageSize) =>
                listItems({ page: requestedPage, pageSize }),
              )
            }
            exportRow={itemCsvRow}
            importHeaders={ITEM_IMPORT_HEADERS}
            importRow={importItem}
            onImported={reload}
          />
          <button type="button" className="button" onClick={() => setFormState({ mode: 'create' })}>
            Add <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selected.size === 0}
            onClick={() => setDeleteTarget({ kind: 'bulk', ids: [...selected.keys()] })}
          >
            Bulk delete{selected.size > 0 && ` (${selected.size})`} <TrashIcon />
          </button>
          {/* Each is enabled only when some selected item would change; the count is how many. */}
          <button
            type="button"
            className="button button--secondary"
            disabled={toShow.length === 0 || visibilityBusy}
            onClick={() => void setSelectedPublic(true)}
          >
            Show on profile{toShow.length > 0 && ` (${toShow.length})`}
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={toHide.length === 0 || visibilityBusy}
            onClick={() => void setSelectedPublic(false)}
          >
            Hide from profile{toHide.length > 0 && ` (${toHide.length})`}
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

      {visibilityResult && 'error' in visibilityResult && (
        <p className="form-error" role="alert">
          {visibilityResult.error}
        </p>
      )}
      {visibilityResult && 'message' in visibilityResult && (
        <p className="muted" role="status">
          {visibilityResult.message}
          {visibilityResult.profileOff && (
            <>
              {' '}
              Your public profile is off, so customers can't see it yet.{' '}
              <Link to="/settings/profile">Turn it on in Settings &gt; Profile</Link>.
            </>
          )}
        </p>
      )}

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
                    checked={selected.has(item.id)}
                    onChange={() => toggleSelected(item)}
                    aria-label={`Select ${item.name}`}
                  />
                </td>
                <td>{item.id}</td>
                <td>
                  {item.name}
                  {item.isPublic && <span className="public-marker">Public</span>}
                </td>
                <td className="numeric">{item.quantity}</td>
                <td className="numeric">{formatCents(item.unitPriceCents, currency)}</td>
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

      {visibilityTarget && (
        <ConfirmDialog
          title={visibilityTarget.isPublic ? 'Show on public profile' : 'Hide from public profile'}
          message={skippedMessage(visibilityTarget)}
          confirmLabel={`${visibilityTarget.isPublic ? 'Show' : 'Hide'} ${itemCount(visibilityTarget.change.length)}`}
          pendingLabel="Saving…"
          danger={false}
          onConfirm={() => applyVisibility(visibilityTarget.isPublic, visibilityTarget.change)}
          onCancel={() => setVisibilityTarget(null)}
        />
      )}
    </section>
  );
}

interface NotSellingPanelProps {
  data?: InventoryInsights;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** In-stock items without sales this month, shown in a scrollable list. */
function NotSellingPanel({ data, error, loading, reload }: NotSellingPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const month = data
    ? new Date(data.periodStart).toLocaleDateString('en-CA', {
        month: 'long',
        timeZone: 'UTC',
      })
    : '';

  return (
    <SummaryPanel
      title={`Not selling${data ? ` (${data.notSelling.length})` : ''}`}
      context={data && `${month}, no sales`}
    >
      {error ? (
        <div className="banner banner--error" role="alert">
          Couldn't load items not selling: {error}{' '}
          <button type="button" className="link-button" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !data ? (
        <p className="empty-state">{loading ? 'Loading…' : 'No data.'}</p>
      ) : data.notSelling.length === 0 ? (
        <p className="empty-state">Every in-stock item has sold this month.</p>
      ) : (
        <>
          <ul className="summary-panel__list" id="not-selling-list">
            {(expanded ? data.notSelling : data.notSelling.slice(0, 3)).map((item) => (
              <li key={item.id} className="summary-panel__row">
                <span className="summary-panel__name">{item.name}</span>
                <span className="summary-panel__detail">{item.quantity} left</span>
              </li>
            ))}
          </ul>
          {data.notSelling.length > 3 && (
            <button
              type="button"
              className="link-button summary-panel__toggle"
              aria-expanded={expanded}
              aria-controls="not-selling-list"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? 'Show less' : 'Expand list'}
            </button>
          )}
        </>
      )}
    </SummaryPanel>
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
  const [expanded, setExpanded] = useState(false);

  return (
    <SummaryPanel
      title={`Low stock${data ? ` (${data.count})` : ''}`}
      context={data && `${data.threshold} or fewer in stock`}
    >
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
          <ul className="summary-panel__list" id="low-stock-list">
            {(expanded ? data.items : data.items.slice(0, 3)).map((item) => (
              <li key={item.id} className="summary-panel__row">
                <span className="summary-panel__name">{item.name}</span>
                <span className={`summary-panel__detail${item.quantity === 0 ? ' is-out' : ''}`}>
                  {item.quantity === 0 ? 'Out of stock' : `${item.quantity} left`}
                </span>
              </li>
            ))}
          </ul>
          {data.items.length > 3 && (
            <button
              type="button"
              className="link-button summary-panel__toggle"
              aria-expanded={expanded}
              aria-controls="low-stock-list"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? 'Show less' : 'Expand list'}
            </button>
          )}
          {data.count > data.items.length && (
            <p className="muted">
              Showing the {data.items.length} lowest of {data.count}.
            </p>
          )}
        </>
      )}
    </SummaryPanel>
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
  const currency = useCurrency();
  return (
    <SummaryPanel title="Stock value" context="at selling price">
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
        <div className="summary-panel__value-block">
          <span className="summary-panel__value">
            {formatCents(data.stockValueCents, currency)}
          </span>
          <span className="muted">{data.totalUnits.toLocaleString()} units in stock</span>
        </div>
      )}
    </SummaryPanel>
  );
}
