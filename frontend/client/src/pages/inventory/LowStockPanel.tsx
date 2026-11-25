import { useState } from 'react';
import { SummaryPanel } from '../../components/SummaryPanel';
import type { LowStock } from '../../types';

interface LowStockPanelProps {
  data?: LowStock;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** Every item at or below the low-stock threshold, lowest first, in a scrollable list. */
export function LowStockPanel({ data, error, loading, reload }: LowStockPanelProps) {
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
