import { useEffect, useState } from 'react';
import { listChannels } from '../../api/channels';
import { getErrorMessage } from '../../api/http';
import type { Channel } from '../../types';

/** The filter inputs' raw values; '' means "any". Dates are "YYYY-MM-DD", as `<input type="date">` gives them. */
export interface SaleFilterValues {
  channelId: string;
  from: string;
  to: string;
}

export const NO_SALE_FILTERS: SaleFilterValues = { channelId: '', from: '', to: '' };

export function hasSaleFilters({ channelId, from, to }: SaleFilterValues): boolean {
  return Boolean(channelId || from || to);
}

/**
 * Keeps a date range in order: moving one end past the other moves the other end with it, so
 * the table never asks the server for an empty, backwards range.
 */
export function withDate(
  values: SaleFilterValues,
  end: 'from' | 'to',
  date: string,
): SaleFilterValues {
  if (end === 'from') {
    return { ...values, from: date, to: date && values.to && values.to < date ? date : values.to };
  }
  return {
    ...values,
    to: date,
    from: date && values.from && values.from > date ? date : values.from,
  };
}

interface SalesFiltersProps {
  value: SaleFilterValues;
  onChange: (value: SaleFilterValues) => void;
}

/** Channel and date-range filters for the sales table. */
export function SalesFilters({ value, onChange }: SalesFiltersProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsError, setChannelsError] = useState<string | null>(null);

  useEffect(() => {
    listChannels()
      .then(setChannels)
      .catch((error: unknown) => setChannelsError(getErrorMessage(error)));
  }, []);

  return (
    <div className="sales-filters" role="group" aria-label="Filter sales">
      <div className="filter-field">
        <label htmlFor="sales-filter-channel">Channel</label>
        <select
          id="sales-filter-channel"
          value={value.channelId}
          onChange={(event) => onChange({ ...value, channelId: event.target.value })}
          aria-describedby={channelsError ? 'sales-filter-channel-error' : undefined}
        >
          <option value="">All channels</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
        {channelsError && (
          <span id="sales-filter-channel-error" className="field-error">
            {channelsError}
          </span>
        )}
      </div>
      <div className="filter-field">
        <label htmlFor="sales-filter-from">From</label>
        <input
          id="sales-filter-from"
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange(withDate(value, 'from', event.target.value))}
        />
      </div>
      <div className="filter-field">
        <label htmlFor="sales-filter-to">To</label>
        <input
          id="sales-filter-to"
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange(withDate(value, 'to', event.target.value))}
        />
      </div>
      {hasSaleFilters(value) && (
        <button
          type="button"
          className="link-button sales-filters__clear"
          onClick={() => onChange(NO_SALE_FILTERS)}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
