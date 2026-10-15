import { useState } from 'react';
import { bulkDeleteItems, createItem, deleteItem, updateItem } from '../../api/items';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { TagList } from '../../components/TagList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useItems } from '../../hooks/useItems';
import type { Item, ItemInput } from '../../types';
import { formatCents } from '../../utils/money';
import { ItemFormModal } from './ItemFormModal';

const PAGE_SIZE = 10;

type FormState = { mode: 'create' } | { mode: 'edit'; item: Item } | null;
type DeleteTarget = { kind: 'single'; item: Item } | { kind: 'bulk'; ids: number[] } | null;

export function InventoryPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const { data, error, loading, reload } = useItems({ page, pageSize: PAGE_SIZE, search });

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
    if (page > 1 && removedFromPage === items.length) setPage(page - 1);
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
            aria-label="Search items by name or tag"
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
                  aria-label="Select all items on this page"
                />
              </th>
              <th>ID</th>
              <th>Name</th>
              <th className="numeric">Qty</th>
              <th className="numeric">Unit price</th>
              <th>Tags</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="table__row"
                onClick={() => setFormState({ mode: 'edit', item })}
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
