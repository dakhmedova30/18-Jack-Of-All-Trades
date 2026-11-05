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
 * A date whose year is still being typed. Chrome reports each keystroke of the year as a full
 * date ("0002-10-05", "0020-…", "0202-…", "2026-…"), so a year below 1000 means "not done yet".
 */
function isPartialDate(date: string): boolean {
  return date !== '' && date < '1000';
}

/** "From must be on or before To" for a finished, backwards range; null otherwise. */
export function saleFiltersProblem({ from, to }: SaleFilterValues): string | null {
  if (!from || !to || isPartialDate(from) || isPartialDate(to)) return null;
  return from > to ? 'From must be on or before To' : null;
}

/** Whether the table can be filtered by these values: no year mid-typing and no backwards range. */
export function canApplySaleFilters(values: SaleFilterValues): boolean {
  return !isPartialDate(values.from) && !isPartialDate(values.to) && !saleFiltersProblem(values);
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

  const rangeProblem = saleFiltersProblem(value);
  const rangeErrorId = rangeProblem ? 'sales-filter-range-error' : undefined;

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
          aria-invalid={rangeProblem ? true : undefined}
          aria-describedby={rangeErrorId}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
        />
      </div>
      <div className="filter-field">
        <label htmlFor="sales-filter-to">To</label>
        <input
          id="sales-filter-to"
          type="date"
          value={value.to}
          min={value.from || undefined}
          aria-invalid={rangeProblem ? true : undefined}
          aria-describedby={rangeErrorId}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
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
      {rangeProblem && (
        <p id={rangeErrorId} className="field-error sales-filters__error" role="alert">
          {rangeProblem}
        </p>
      )}
    </div>
  );
}
