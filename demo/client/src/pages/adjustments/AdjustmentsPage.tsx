import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createAdjustment, deactivateAdjustment, listAdjustments, updateAdjustment, type AdjustmentInput } from '../../api/adjustments';
import { getErrorMessage } from '../../api/http';
import { listItems } from '../../api/items';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon } from '../../components/icons';
import { Modal } from '../../components/Modal';
import type { Adjustment, Item } from '../../types';
import { centsToInputValue, formatCents, MAX_AMOUNT_CENTS, parseDollarsToCents } from '../../utils/money';

type FormState = 'create' | { mode: 'edit'; adjustment: Adjustment } | null;
type DeleteState = Adjustment | null;

const blankAdjustment: AdjustmentInput = {
  name: '',
  kind: 'DISCOUNT',
  scope: 'SALE',
  operation: 'AMOUNT',
  value: 0,
  itemIds: [],
  tags: [],
  buyQuantity: null,
  freeQuantity: null,
  active: true,
};

function ruleDescription(adjustment: Adjustment) {
  if (adjustment.operation === 'BUY_GET')
    return `Buy ${adjustment.buyQuantity}, get ${adjustment.freeQuantity} free`;
  if (adjustment.operation === 'PERCENTAGE')
    return `${(adjustment.value / 100).toFixed(2)}% ${adjustment.kind === 'DISCOUNT' ? 'off' : 'charge'}`;
  const amount = formatCents(adjustment.value);
  return `${amount} ${adjustment.scope === 'SALE' ? 'per sale' : 'per eligible item'}`;
}

function targetDescription(adjustment: Adjustment, items: Item[]) {
  if (adjustment.scope === 'SALE') return 'Whole sale';
  if (adjustment.scope === 'ITEMS')
    return `Items: ${adjustment.itemIds.map((id) => items.find((item) => item.id === id)?.name ?? `#${id}`).join(', ')}`;
  return `Any of: ${adjustment.tags.join(', ')}`;
}

interface AdjustmentFormProps {
  adjustment?: Adjustment;
  items: Item[];
  onCancel: () => void;
  onSubmit: (input: AdjustmentInput) => Promise<void>;
}

function AdjustmentFormModal({ adjustment, items, onCancel, onSubmit }: AdjustmentFormProps) {
  const [name, setName] = useState(adjustment?.name ?? blankAdjustment.name);
  const [kind, setKind] = useState<AdjustmentInput['kind']>(adjustment?.kind ?? blankAdjustment.kind);
  const [scope, setScope] = useState<AdjustmentInput['scope']>(adjustment?.scope ?? blankAdjustment.scope);
  const [operation, setOperation] = useState<AdjustmentInput['operation']>(adjustment?.operation ?? blankAdjustment.operation);
  const [value, setValue] = useState(() => {
    if (!adjustment) return '';
    return adjustment.operation === 'AMOUNT'
      ? centsToInputValue(adjustment.value)
      : adjustment.operation === 'PERCENTAGE'
        ? (adjustment.value / 100).toFixed(2)
        : '';
  });
  const [itemIds, setItemIds] = useState(adjustment?.itemIds ?? []);
  const [tags, setTags] = useState(adjustment?.tags ?? []);
  const [buyQuantity, setBuyQuantity] = useState(adjustment?.buyQuantity ? String(adjustment.buyQuantity) : '');
  const [freeQuantity, setFreeQuantity] = useState(adjustment?.freeQuantity ? String(adjustment.freeQuantity) : '');
  const [active, setActive] = useState(adjustment?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const availableTags = [...new Set(items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b));

  function toggleItem(id: number) {
    setItemIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleTag(tag: string) {
    setTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError('Enter a name for this discount or charge.');
    let amount = 0;
    if (operation === 'AMOUNT') {
      const cents = parseDollarsToCents(value);
      if (cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS)
        return setError('Enter a positive amount in CAD.');
      amount = cents;
    } else if (operation === 'PERCENTAGE') {
      const percentage = Number(value);
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100)
        return setError('Enter a percentage greater than 0 and no more than 100.');
      amount = Math.round(percentage * 100);
    } else {
      const buy = Number(buyQuantity);
      const free = Number(freeQuantity);
      if (!Number.isInteger(buy) || buy < 1 || !Number.isInteger(free) || free < 1 || buy + free > 50)
        return setError('Enter valid buy and free quantities (up to 50 total).');
    }
    if (scope === 'ITEMS' && itemIds.length === 0)
      return setError('Choose at least one inventory item.');
    if (scope === 'TAGS' && tags.length === 0)
      return setError('Choose at least one inventory tag.');

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        kind,
        scope,
        operation,
        value: amount,
        itemIds: scope === 'ITEMS' ? itemIds : [],
        tags: scope === 'TAGS' ? tags : [],
        buyQuantity: operation === 'BUY_GET' ? Number(buyQuantity) : null,
        freeQuantity: operation === 'BUY_GET' ? Number(freeQuantity) : null,
        active,
      });
    } catch (reason) {
      setError(getErrorMessage(reason));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={adjustment ? 'Edit discount or charge' : 'Add discount or charge'}
      onClose={onCancel}
      size="large"
      footer={<>
        <button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" form="adjustment-form" className="button" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </>}
    >
      <form id="adjustment-form" className="item-form" onSubmit={submit} noValidate>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        </label>
        <div className="adjustment-form__grid">
          <label>Kind
            <select value={kind} onChange={(event) => {
              const next = event.target.value as AdjustmentInput['kind'];
              setKind(next);
              if (next === 'CHARGE' && operation === 'BUY_GET') setOperation('AMOUNT');
            }}>
              <option value="DISCOUNT">Discount</option>
              <option value="CHARGE">Charge</option>
            </select>
          </label>
          <label>Applies to
            <select value={scope} onChange={(event) => setScope(event.target.value as AdjustmentInput['scope'])}>
              <option value="SALE">Whole sale</option>
              <option value="ITEMS">Selected inventory items</option>
              <option value="TAGS">Items matching any selected tag</option>
            </select>
          </label>
          <label>Rule
            <select value={operation} onChange={(event) => setOperation(event.target.value as AdjustmentInput['operation'])}>
              <option value="AMOUNT">Fixed amount</option>
              <option value="PERCENTAGE">Percentage</option>
              {kind === 'DISCOUNT' && <option value="BUY_GET">Buy X, get Y free</option>}
            </select>
          </label>
        </div>
        {operation === 'AMOUNT' && (
          <label>Amount (CAD)
            <input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="5.00" />
            <span className="muted">{scope === 'SALE' ? 'Applied once to the sale.' : 'Applied per matching item.'}</span>
          </label>
        )}
        {operation === 'PERCENTAGE' && (
          <label>Percentage
            <input type="number" min="0.01" max="100" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} placeholder="20" />
            <span className="muted">Applied to the matching item total or the full sale subtotal.</span>
          </label>
        )}
        {operation === 'BUY_GET' && (
          <div className="adjustment-form__grid">
            <label>Buy<input type="number" min="1" max="49" value={buyQuantity} onChange={(event) => setBuyQuantity(event.target.value)} /></label>
            <label>Get free<input type="number" min="1" max="49" value={freeQuantity} onChange={(event) => setFreeQuantity(event.target.value)} /></label>
            <p className="muted">The lowest-priced eligible items are free in each complete group.</p>
          </div>
        )}
        {scope === 'ITEMS' && (
          <fieldset className="adjustment-targets">
            <legend>Eligible inventory items</legend>
            {items.map((item) => (
              <label className="item-form__check" key={item.id}>
                <input type="checkbox" checked={itemIds.includes(item.id)} onChange={() => toggleItem(item.id)} />
                {item.name}
              </label>
            ))}
            {items.length === 0 && <p className="muted">No inventory items are available.</p>}
          </fieldset>
        )}
        {scope === 'TAGS' && (
          <fieldset className="adjustment-targets">
            <legend>Eligible item tags (any selected tag matches)</legend>
            {availableTags.map((tag) => (
              <label className="item-form__check" key={tag}>
                <input type="checkbox" checked={tags.includes(tag)} onChange={() => toggleTag(tag)} />
                {tag}
              </label>
            ))}
            {availableTags.length === 0 && <p className="muted">Add tags to inventory items before targeting tags.</p>}
          </fieldset>
        )}
        {adjustment && (
          <label className="item-form__check">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Active and available in sales
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

export function AdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<Adjustment[] | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteState>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setError(null);
    try {
      const [nextAdjustments, itemPage] = await Promise.all([
        listAdjustments(),
        listItems({ page: 1, pageSize: 100 }),
      ]);
      setAdjustments(nextAdjustments);
      setItems(itemPage.data);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  async function save(input: AdjustmentInput) {
    if (form && typeof form === 'object')
      await updateAdjustment(form.adjustment.id, input);
    else await createAdjustment(input);
    setForm(null);
    await reload();
  }

  async function archive() {
    if (!deleteTarget) return;
    await deactivateAdjustment(deleteTarget.id);
    setDeleteTarget(null);
    await reload();
  }

  const active = (adjustments ?? []).filter((adjustment) => adjustment.active);
  const mostUsed = useMemo(
    () => [...active].sort((a, b) => b.useCount - a.useCount || b.amountAppliedCadCents - a.amountAppliedCadCents)[0],
    [active],
  );
  const mostImpact = useMemo(
    () => [...active].sort((a, b) => b.amountAppliedCadCents - a.amountAppliedCadCents || b.useCount - a.useCount)[0],
    [active],
  );

  return (
    <section className="page">
      <header className="market-page__header">
        <div>
          <h1>Discounts &amp; Charges</h1>
          <p className="muted">Create reusable rules for sales and in-person markets. Fixed amounts are entered in CAD.</p>
        </div>
        <button type="button" className="button" onClick={() => setForm('create')}>Add adjustment <PlusIcon /></button>
      </header>
      {error && <div className="banner banner--error" role="alert">{error}{' '}
        <button type="button" className="link-button" onClick={() => void reload()}>Retry</button>
      </div>}
      <div className="market-summary">
        <article className="summary-panel"><span>Most used</span><strong>{mostUsed ? `${mostUsed.name} · ${mostUsed.useCount} uses` : 'No uses yet'}</strong></article>
        <article className="summary-panel"><span>Largest total impact</span><strong>{mostImpact ? `${mostImpact.name} · ${formatCents(mostImpact.amountAppliedCadCents)}` : 'No uses yet'}</strong></article>
      </div>
      <section className="panel adjustment-page__panel">
        <div className="market-list__header"><h2>Reusable adjustments</h2><span className="muted">{adjustments?.length ?? 0} total</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Kind</th><th>Rule</th><th>Applies to</th><th className="numeric">Uses</th><th className="numeric">Impact (CAD)</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {adjustments?.map((adjustment) => (
                <tr key={adjustment.id}>
                  <td>{adjustment.name}</td>
                  <td>{adjustment.kind === 'DISCOUNT' ? 'Discount' : 'Charge'}</td>
                  <td>{ruleDescription(adjustment)}</td>
                  <td>{targetDescription(adjustment, items)}</td>
                  <td className="numeric">{adjustment.useCount}</td>
                  <td className="numeric">{formatCents(adjustment.amountAppliedCadCents)}</td>
                  <td>{adjustment.active ? 'Active' : 'Archived'}</td>
                  <td className="market-table__actions">
                    <button type="button" className="link-button" onClick={() => setForm({ mode: 'edit', adjustment })}>Edit</button>
                    {adjustment.active && <button type="button" className="link-button danger-link" onClick={() => setDeleteTarget(adjustment)}>Archive</button>}
                  </td>
                </tr>
              ))}
              {!loading && adjustments?.length === 0 && <tr><td colSpan={8} className="muted">No adjustments yet. Add one to reuse it in a sale.</td></tr>}
              {loading && <tr><td colSpan={8} className="muted">Loading adjustments…</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted">Impact is the sum of adjustments actually applied, converted to CAD. Archived adjustments remain on past sales.</p>
      </section>
      {form && (
        <AdjustmentFormModal
          adjustment={typeof form === 'object' ? form.adjustment : undefined}
          items={items}
          onCancel={() => setForm(null)}
          onSubmit={save}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Archive adjustment?"
          message="It will no longer be offered for new sales, but stays on historical transactions."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={archive}
        />
      )}
    </section>
  );
}
