import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listChannels } from '../../api/channels';
import { getMarket } from '../../api/markets';
import { bulkDeleteSales, createSale, deleteSale, listSales, updateSale } from '../../api/sales';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { useLoad } from '../../hooks/useLoad';
import { usePreferences } from '../../hooks/usePreferences';
import type { Sale, SaleInput } from '../../types';
import { formatCents } from '../../utils/money';
import { MarketSaleFormModal } from './MarketSaleFormModal';
import { TipFormModal } from './TipFormModal';

type FormState =
  | { kind: 'sale'; sale?: Sale }
  | { kind: 'tip'; sale?: Sale }
  | null;
type DeleteTarget = { kind: 'single'; sale: Sale } | { kind: 'bulk'; ids: number[] } | null;

const isTipOnly = (sale: Sale) => sale.items.every((line) => line.kind === 'TIP');

/** "Print x 2, Sticker x 1 (free), Discount: 10% off" */
function describeSale(sale: Sale): string {
  return sale.items
    .filter((line) => line.kind !== 'TIP')
    .map((line) => {
      if (line.kind !== 'ITEM') return line.itemName;
      const flag = line.isFree ? ' (free)' : line.isTrade ? ' (trade)' : '';
      return `${line.itemName} x ${line.quantity}${flag}`;
    })
    .join(', ');
}

function saleTotal(sale: Sale): number {
  return sale.items.reduce((sum, line) => sum + line.totalCents, 0);
}

export function MarketDetailPage() {
  const marketId = Number(useParams().marketId);
  const { formatDate } = usePreferences();
  const market = useLoad(() => getMarket(marketId), [marketId]);
  const sales = useLoad(() => listSales({ page: 1, pageSize: 100, marketId, sort: 'soldAt', order: 'asc' }), [marketId]);
  const channels = useLoad(listChannels);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const info = market.data;
  const all = sales.data?.data ?? [];
  const saleRows = all.filter((sale) => !isTipOnly(sale));
  const tipRows = all.filter(isTipOnly);
  const channelId =
    channels.data?.find((channel) => channel.name.toLowerCase() === 'in person')?.id ??
    channels.data?.[0]?.id;

  function reloadAll() {
    market.reload();
    sales.reload();
  }

  function toggleSelected(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave(input: SaleInput) {
    if (formState?.sale) await updateSale(formState.sale.id, input);
    else await createSale(input);
    setFormState(null);
    reloadAll();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.kind === 'single' ? [deleteTarget.sale.id] : deleteTarget.ids;
    if (deleteTarget.kind === 'single') await deleteSale(deleteTarget.sale.id);
    else await bulkDeleteSales(ids);
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))));
    setDeleteTarget(null);
    reloadAll();
  }

  const error = market.error ?? sales.error;
  if (error && !info) {
    return (
      <section className="page">
        <div className="banner banner--error" role="alert">
          {error}
        </div>
        <Link to="/sales/in-person">Back to markets</Link>
      </section>
    );
  }

  const allSelected = saleRows.length > 0 && saleRows.every((sale) => selected.has(sale.id));
  const currency = info?.currency ?? 'CAD';

  return (
    <section className="page">
      <div>
        <p>
          <Link to="/sales/in-person">← In-Person Market</Link>
        </p>
        <h1>{info?.name ?? 'Market'}</h1>
        {info && (
          <p className="muted">
            {info.location ? `${info.location} · ` : ''}
            {formatDate(info.startDate)}
            {info.endDate !== info.startDate && ` – ${formatDate(info.endDate)}`} · {info.currency}
          </p>
        )}
      </div>

      <div className="toolbar">
        <div className="toolbar__actions">
          <button
            type="button"
            className="button"
            disabled={!info}
            onClick={() => setFormState({ kind: 'sale' })}
          >
            Add sale <PlusIcon />
          </button>
          <button
            type="button"
            className="button button--secondary"
            disabled={!info || channelId === undefined}
            onClick={() => setFormState({ kind: 'tip' })}
          >
            Add tip <PlusIcon />
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
          {error}
        </div>
      )}

      <div className={`table-wrap${sales.loading && sales.data ? ' is-loading' : ''}`}>
        <table className="table">
          <thead>
            <tr>
              <th className="table__check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(saleRows.map((sale) => sale.id)))
                  }
                  aria-label="Select all sales"
                />
              </th>
              <th>#</th>
              <th>ID</th>
              <th>Date</th>
              <th>Items</th>
              <th className="numeric">Total</th>
              <th className="table__action">Delete</th>
            </tr>
          </thead>
          <tbody>
            {saleRows.map((sale, index) => (
              <tr
                key={sale.id}
                className="table__row"
                tabIndex={0}
                aria-label={`Edit sale ${sale.id}`}
                onClick={() => setFormState({ kind: 'sale', sale })}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setFormState({ kind: 'sale', sale });
                  }
                }}
              >
                <td className="table__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(sale.id)}
                    onChange={() => toggleSelected(sale.id)}
                    aria-label={`Select sale ${sale.id}`}
                  />
                </td>
                <td>{index + 1}</td>
                <td>{sale.id}</td>
                <td>{formatDate(sale.soldAt)}</td>
                <td className="table__description" title={describeSale(sale)}>
                  {describeSale(sale)}
                </td>
                <td className="numeric">{formatCents(saleTotal(sale), sale.originalCurrency)}</td>
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
          {info && (
            <tfoot>
              <tr>
                <th scope="row" colSpan={5}>
                  Tips
                </th>
                <td className="numeric">{formatCents(info.tipsCents, currency)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row" colSpan={5}>
                  Total revenue
                </th>
                <td className="numeric">{formatCents(info.revenueCents, currency)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row" colSpan={5}>
                  Expenses (table fee + extra)
                </th>
                <td className="numeric">{formatCents(info.expensesCents, currency)}</td>
                <td />
              </tr>
              <tr>
                <th scope="row" colSpan={5}>
                  Profit
                </th>
                <td className="numeric">{formatCents(info.profitCents, currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {sales.data && saleRows.length === 0 && (
          <p className="empty-state">No sales recorded for this market yet</p>
        )}
      </div>

      {tipRows.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption>Tip entries</caption>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th className="numeric">Amount</th>
                <th className="table__action">Delete</th>
              </tr>
            </thead>
            <tbody>
              {tipRows.map((sale) => (
                <tr
                  key={sale.id}
                  className="table__row"
                  tabIndex={0}
                  aria-label={`Edit tip ${sale.id}`}
                  onClick={() => setFormState({ kind: 'tip', sale })}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setFormState({ kind: 'tip', sale });
                    }
                  }}
                >
                  <td>{sale.id}</td>
                  <td>{formatDate(sale.soldAt)}</td>
                  <td className="numeric">{formatCents(saleTotal(sale), sale.originalCurrency)}</td>
                  <td className="table__action">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete tip ${sale.id}`}
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
        </div>
      )}

      {info && formState?.kind === 'sale' && (
        <MarketSaleFormModal
          market={info}
          sale={formState.sale}
          onCancel={() => setFormState(null)}
          onSubmit={handleSave}
        />
      )}
      {info && formState?.kind === 'tip' && channelId !== undefined && (
        <TipFormModal
          market={info}
          channelId={formState.sale?.channel?.id ?? channelId}
          sale={formState.sale}
          onCancel={() => setFormState(null)}
          onSubmit={handleSave}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete confirmation"
          message={
            deleteTarget.kind === 'single'
              ? `Do you want to delete #${deleteTarget.sale.id}? This restores its items to stock.`
              : `Do you want to delete ${deleteTarget.ids.length} selected sale(s)? This restores their items to stock.`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
