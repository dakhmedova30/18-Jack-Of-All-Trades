import { useState } from 'react';
import {
  bulkDeleteDiscounts,
  createDiscount,
  deleteDiscount,
  listDiscounts,
  updateDiscount,
} from '../../api/discounts';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { TagList } from '../../components/TagList';
import { useLoad } from '../../hooks/useLoad';
import type { Discount, DiscountInput } from '../../types';
import { formatCents } from '../../utils/money';
import { DiscountFormModal } from './DiscountFormModal';

type FormState = { mode: 'create' } | { mode: 'edit'; discount: Discount } | null;
type DeleteTarget = { kind: 'single'; discount: Discount } | { kind: 'bulk'; ids: number[] } | null;

const KIND_NAMES = { PRESET: 'Preset', PER_AMOUNT: 'Per amount', SOLID: 'Solid amount' } as const;

function formatValue(discount: Discount): string {
  if (discount.value === null) return '';
  return discount.valueType === 'PERCENT'
    ? `${discount.value}%`
    : formatCents(Math.round(discount.value * 100), discount.currency);
}

/** A short plain-language summary of how the discount works. */
function describe(discount: Discount): string {
  const verb = discount.isCharge ? 'adds' : 'takes off';
  switch (discount.kind) {
    case 'PRESET':
      return `Buy ${discount.buyCount}, get ${discount.getCount}: ${verb} ${formatValue(discount)} on the extra items`;
    case 'SOLID':
      return `${verb[0].toUpperCase()}${verb.slice(1)} ${formatValue(discount)}`;
    case 'PER_AMOUNT':
      return discount.tiers
        .map((tier) => `${tier.count} for ${formatCents(tier.priceCents, discount.currency)}`)
        .join(', ');
  }
}

export function DiscountsPage() {
  const { data, error, loading, reload } = useLoad(listDiscounts);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const discounts = data ?? [];
  const allSelected = discounts.length > 0 && discounts.every((entry) => selected.has(entry.id));

  function toggleSelected(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave(input: DiscountInput) {
    if (formState?.mode === 'edit') await updateDiscount(formState.discount.id, input);
    else await createDiscount(input);
    setFormState(null);
    reload();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.kind === 'single' ? [deleteTarget.discount.id] : deleteTarget.ids;
    if (deleteTarget.kind === 'single') await deleteDiscount(deleteTarget.discount.id);
    else await bulkDeleteDiscounts(ids);
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setDeleteTarget(null);
    reload();
  }

  return (
    <section className="page">
      <div>
        <h1>Discounts &amp; Charges</h1>
        <p className="muted">
          Reusable discounts and charges you can apply when recording In-Person Markets and
          Miscellaneous sales.
        </p>
      </div>

      <div className="toolbar">
        <div className="toolbar__actions">
          <button type="button" className="button" onClick={() => setFormState({ mode: 'create' })}>
            Add <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={selected.size === 0}
            onClick={() => setDeleteTarget({ kind: 'bulk', ids: [...selected] })}
          >
            Bulk Delete{selected.size > 0 && ` (${selected.size})`} <TrashIcon />
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
                    setSelected(allSelected ? new Set() : new Set(discounts.map((entry) => entry.id)))
                  }
                  aria-label="Select all discounts"
                />
              </th>
              <th>ID</th>
              <th>Name</th>
              <th>Kind</th>
              <th>Applicable to</th>
              <th>Details</th>
              <th>Currency</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map((discount) => (
              <tr
                key={discount.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit ${discount.name}`}
                onClick={() => setFormState({ mode: 'edit', discount })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ mode: 'edit', discount });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(discount.id)}
                    onChange={() => toggleSelected(discount.id)}
                    aria-label={`Select ${discount.name}`}
                  />
                </td>
                <td>{discount.id}</td>
                <td>
                  {discount.name}
                  {discount.isCharge && <span className="public-marker">Charge</span>}
                </td>
                <td>{KIND_NAMES[discount.kind]}</td>
                <td>
                  <TagList tags={discount.appliesTo ? [discount.appliesTo] : []} />
                  {!discount.appliesTo && <span className="muted">All items</span>}
                </td>
                <td>{describe(discount)}</td>
                <td>{discount.currency}</td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${discount.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'single', discount });
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
        {data && discounts.length === 0 && (
          <div className="empty-state">
            <p>Add a discount or charge to reuse on your sales</p>
            <button type="button" className="button" onClick={() => setFormState({ mode: 'create' })}>
              Add <PlusIcon />
            </button>
          </div>
        )}
      </div>

      {formState && (
        <DiscountFormModal
          discount={formState.mode === 'edit' ? formState.discount : undefined}
          onCancel={() => setFormState(null)}
          onSubmit={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'single'
              ? `Do you want to delete “${deleteTarget.discount.name}”? Past sales keep their amounts.`
              : `Do you want to delete ${deleteTarget.ids.length} selected discount(s)? Past sales keep their amounts.`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
