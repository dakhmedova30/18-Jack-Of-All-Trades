import { useState } from 'react';
import { SummaryPanel } from '../../components/SummaryPanel';
import type { InventoryInsights } from '../../types';

interface NotSellingPanelProps {
  data?: InventoryInsights;
  error?: string;
  loading: boolean;
  reload: () => void;
}

/** In-stock items without sales this month, shown in a scrollable list. */
export function NotSellingPanel({ data, error, loading, reload }: NotSellingPanelProps) {
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
