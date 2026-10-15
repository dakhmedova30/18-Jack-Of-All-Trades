import { useState } from 'react';
import { bulkDeleteSales, createSale, deleteSale, updateSale } from '../../api/sales';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, SearchIcon, TrashIcon } from '../../components/icons';
import { Pagination } from '../../components/Pagination';
import { TagList } from '../../components/TagList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSales } from '../../hooks/useSales';
import type { Sale, SaleInput } from '../../types';
import { formatDate } from '../../utils/date';
import { formatCents } from '../../utils/money';
import { SaleFormModal } from './SaleFormModal';

const PAGE_SIZE = 10;

type FormState = { mode: 'create' } | { mode: 'edit'; sale: Sale } | null;
type DeleteTarget = { kind: 'single'; sale: Sale } | { kind: 'bulk'; ids: number[] } | null;

export function SalesPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const { data, error, loading, reload } = useSales({ page, pageSize: PAGE_SIZE, search });

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
    if (page > 1 && removedFromPage === sales.length) setPage(page - 1);
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
            aria-label="Search sales by tag or item"
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
                  aria-label="Select all sales on this page"
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
            {sales.map((sale) => (
              <tr
                key={sale.id}
                className="table__row"
                onClick={() => setFormState({ mode: 'edit', sale })}
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
                <td className="numeric">{formatCents(sale.totalCents)}</td>
                <td>
                  <TagList tags={sale.tags} />
                </td>
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
