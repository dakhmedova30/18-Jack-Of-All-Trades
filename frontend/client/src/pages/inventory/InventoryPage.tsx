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
import { PlusIcon, TrashIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { TagList } from '../../components/TagList';
import { Toolbar } from '../../components/Toolbar';
import { useAuth } from '../../hooks/useAuth';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useItems } from '../../hooks/useItems';
import { usePreferences } from '../../hooks/usePreferences';
import type { Item, ItemInput, ItemSortField, SortOrder } from '../../types';
import { formatCents } from '../../utils/money';
import { fetchAllPages } from '../../utils/csv';
import {
  itemCsvRow,
  importItemFromCsv,
  ITEM_CSV_HEADERS,
  ITEM_IMPORT_HEADERS,
} from '../../utils/businessCsv';
import { ItemFormModal } from './ItemFormModal';

const SORTABLE_COLUMNS: { field: ItemSortField; label: string; numeric?: boolean }[] = [
  { field: 'id', label: 'ID' },
  { field: 'name', label: 'Name' },
  { field: 'quantity', label: 'Qty', numeric: true },
  { field: 'unitPriceCents', label: 'Price', numeric: true },
];

function formatSize(item: Item): string {
  return item.width != null && item.height != null && item.sizeUnit
    ? `${item.width} × ${item.height} ${item.sizeUnit}`
    : '—';
}

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
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<{ field: ItemSortField; order: SortOrder }>({
    field: 'id',
    order: 'asc',
  });
  const search = useDebouncedValue(searchInput.trim());
  const { data, error, loading, reload } = useItems({
    page,
    pageSize: preferences.rowsPerPage,
    search,
    sort: sort.field,
    order: sort.order,
  });

  async function importItem(record: Record<string, string>) {
    return importItemFromCsv(record, updateItem, createItem);
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
    if (formState?.mode === 'edit') {
      await updateItem(formState.item.id, { ...input, clearSize: input.width === null });
    } else await createItem(input);
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
    if (page > 1 && removedFromPage === items.length) setPage(page - 1);
    else reload();
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
    reload();
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

      <Toolbar
        selectedCount={selected.size}
        onAdd={() => setFormState({ mode: 'create' })}
        onDelete={() => setDeleteTarget({ kind: 'bulk', ids: [...selected.keys()] })}
        profileActions={
          selected.size > 0 ? (
            <>
              <button
                type="button"
                className="button button--ghost"
                disabled={toShow.length === 0 || visibilityBusy}
                onClick={() => void setSelectedPublic(true)}
                aria-label={`Show on profile${toShow.length > 0 ? ` (${toShow.length})` : ''}`}
              >
                <span className="toolbar__profile-label">
                  Show on profile{toShow.length > 0 && ` (${toShow.length})`}
                </span>
                <span className="toolbar__profile-compact">Show</span>
              </button>
              <button
                type="button"
                className="button button--ghost"
                disabled={toHide.length === 0 || visibilityBusy}
                onClick={() => void setSelectedPublic(false)}
                aria-label={`Hide from profile${toHide.length > 0 ? ` (${toHide.length})` : ''}`}
              >
                <span className="toolbar__profile-label">
                  Hide from profile{toHide.length > 0 && ` (${toHide.length})`}
                </span>
                <span className="toolbar__profile-compact">Hide</span>
              </button>
            </>
          ) : undefined
        }
        search={
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
          </div>
        }
        transfer={
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
        }
      />

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
              <th className="numeric">Amount sold</th>
              <th className="numeric">Total</th>
              <th>Size</th>
              <th>Tags</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`table__row${!item.isActive || item.quantity === 0 ? ' is-inactive' : ''}`}
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
                  {!item.isActive && <span className="public-marker">Inactive</span>}
                </td>
                <td className="numeric">{item.quantity}</td>
                <td className="numeric">{formatCents(item.unitPriceCents, item.currency)}</td>
                <td className="numeric">{item.amountSold}</td>
                <td className="numeric">
                  {formatCents(item.unitPriceCents * item.amountSold, item.currency)}
                </td>
                <td>{formatSize(item)}</td>
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
          {items.length > 0 && (
            <tfoot>
              <tr>
                <td />
                <td colSpan={2}>Totals (this page)</td>
                <td className="numeric">{items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td />
                <td className="numeric">{items.reduce((sum, item) => sum + item.amountSold, 0)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
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
