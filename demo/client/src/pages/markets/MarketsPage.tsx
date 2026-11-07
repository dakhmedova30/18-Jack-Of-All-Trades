import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  bulkDeleteMarkets,
  createMarket,
  deleteMarket,
  listMarkets,
  updateMarket,
} from '../../api/markets';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { TagList } from '../../components/TagList';
import { useLoad } from '../../hooks/useLoad';
import { usePreferences } from '../../hooks/usePreferences';
import type { Market, MarketInput } from '../../types';
import { formatCents } from '../../utils/money';
import { MarketFormModal } from './MarketFormModal';

type FormState = { mode: 'create' } | { mode: 'edit'; market: Market } | null;
type DeleteTarget = { kind: 'single'; market: Market } | { kind: 'bulk'; ids: number[] } | null;

const LABELS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  WAITLISTED: 'Waitlisted',
  REJECTED: 'Rejected',
  YES: 'Yes',
  NO: 'No',
} as const;

function formatRange(start: string, end: string, format: (iso: string) => string): string {
  return start === end ? format(start) : `${format(start)} – ${format(end)}`;
}

export function MarketsPage() {
  const { data, error, loading, reload } = useLoad(listMarkets);
  const { formatDate } = usePreferences();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const markets = data ?? [];
  const allSelected = markets.length > 0 && markets.every((entry) => selected.has(entry.id));
  const knownTags = [...new Set(markets.flatMap((market) => market.tags))];

  // Markets can be in different currencies, so totals are kept per currency.
  const totals = [...new Set(markets.map((market) => market.currency))].map((currency) => {
    const group = markets.filter((market) => market.currency === currency);
    const sum = (pick: (market: Market) => number) => group.reduce((acc, m) => acc + pick(m), 0);
    return {
      currency,
      tableFee: sum((m) => m.tableFeeCents),
      extra: sum((m) => m.extraExpensesCents),
      expenses: sum((m) => m.expensesCents),
      revenue: sum((m) => m.revenueCents),
      profit: sum((m) => m.profitCents),
    };
  });

  function toggleSelected(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave(input: MarketInput) {
    if (formState?.mode === 'edit') await updateMarket(formState.market.id, input);
    else await createMarket(input);
    setFormState(null);
    reload();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.kind === 'single' ? [deleteTarget.market.id] : deleteTarget.ids;
    if (deleteTarget.kind === 'single') await deleteMarket(deleteTarget.market.id);
    else await bulkDeleteMarkets(ids);
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setDeleteTarget(null);
    reload();
  }

  return (
    <section className="page">
      <div>
        <h1>In-Person Market</h1>
        <p className="muted">
          Markets you’ve applied to or attended. Open a market’s name to record its sales and tips.
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
            Bulk delete{selected.size > 0 && ` (${selected.size})`} <TrashIcon />
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
                    setSelected(allSelected ? new Set() : new Set(markets.map((entry) => entry.id)))
                  }
                  aria-label="Select all markets"
                />
              </th>
              <th>ID</th>
              <th>Name</th>
              <th>Dates</th>
              <th>Location</th>
              <th className="numeric">Table fee</th>
              <th className="numeric">Extra expenses</th>
              <th>Currency</th>
              <th>Website</th>
              <th>Status</th>
              <th>Going</th>
              <th>Tags</th>
              <th className="numeric">Expenses</th>
              <th className="numeric">Revenue</th>
              <th className="numeric">Profit</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((market) => (
              <tr
                key={market.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit ${market.name}`}
                onClick={() => setFormState({ mode: 'edit', market })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ mode: 'edit', market });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(market.id)}
                    onChange={() => toggleSelected(market.id)}
                    aria-label={`Select ${market.name}`}
                  />
                </td>
                <td>{market.id}</td>
                <td>
                  <Link
                    to={`/sales/in-person/${market.id}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {market.name}
                  </Link>
                </td>
                <td>{formatRange(market.startDate, market.endDate, formatDate)}</td>
                <td>{market.location || <span className="muted">—</span>}</td>
                <td className="numeric">{formatCents(market.tableFeeCents, market.currency)}</td>
                <td className="numeric">{formatCents(market.extraExpensesCents, market.currency)}</td>
                <td>{market.currency}</td>
                <td onClick={(event) => event.stopPropagation()}>
                  {market.website ? (
                    <a href={market.website} target="_blank" rel="noopener noreferrer">
                      Link
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{LABELS[market.status]}</td>
                <td>{LABELS[market.going]}</td>
                <td>
                  <TagList tags={market.tags} />
                </td>
                <td className="numeric">{formatCents(market.expensesCents, market.currency)}</td>
                <td className="numeric">{formatCents(market.revenueCents, market.currency)}</td>
                <td className="numeric">{formatCents(market.profitCents, market.currency)}</td>
                <td className="table__action">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${market.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget({ kind: 'single', market });
                    }}
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {totals.length > 0 && (
            <tfoot>
              {totals.map((row) => (
                <tr key={row.currency}>
                  <th scope="row" colSpan={5}>
                    Total ({row.currency})
                  </th>
                  <td className="numeric">{formatCents(row.tableFee, row.currency)}</td>
                  <td className="numeric">{formatCents(row.extra, row.currency)}</td>
                  <td colSpan={5} />
                  <td className="numeric">{formatCents(row.expenses, row.currency)}</td>
                  <td className="numeric">{formatCents(row.revenue, row.currency)}</td>
                  <td className="numeric">{formatCents(row.profit, row.currency)}</td>
                  <td />
                </tr>
              ))}
            </tfoot>
          )}
        </table>

        {!data && loading && <p className="empty-state">Loading…</p>}
        {data && markets.length === 0 && (
          <div className="empty-state">
            <p>Add your first market to start tracking sales</p>
            <button type="button" className="button" onClick={() => setFormState({ mode: 'create' })}>
              Add <PlusIcon />
            </button>
          </div>
        )}
      </div>

      {formState && (
        <MarketFormModal
          market={formState.mode === 'edit' ? formState.market : undefined}
          knownTags={knownTags}
          onCancel={() => setFormState(null)}
          onSubmit={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'single'
              ? `Do you want to delete “${deleteTarget.market.name}”? Its sales and tips are deleted too, and the items sold return to stock.`
              : `Do you want to delete ${deleteTarget.ids.length} selected market(s)? Their sales and tips are deleted too, and the items sold return to stock.`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
