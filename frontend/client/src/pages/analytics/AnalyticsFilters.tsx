import { useState } from 'react';
import { DateRangeSlider } from '../../components/DateRangeSlider';
import type { AnalyticsDateRange, Channel, DateRange } from '../../types';
import { daysBetween, formatDate, isDateKey } from '../../utils/date';

interface AnalyticsFiltersProps {
  /** The first and last day with records: the ends of the slider and the limits of the fields. */
  dates: AnalyticsDateRange;
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** The business's channels; undefined while they load. */
  channels: Channel[] | undefined;
  channelsError: string | undefined;
  /** The chosen channel's id, or '' for all channels. */
  channelId: string;
  onChannelChange: (channelId: string) => void;
  /** Back to the period the page opened with and all channels; disabled when `isDefault`. */
  onReset: () => void;
  isDefault: boolean;
}

/**
 * The Analytics side bar. It filters by date, two ways that stay in step (Start and End date
 * fields, and a slider running from the first record to the latest), and by sales channel.
 */
export function AnalyticsFilters({
  dates,
  value,
  onChange,
  channels,
  channelsError,
  channelId,
  onChannelChange,
  onReset,
  isDefault,
}: AnalyticsFiltersProps) {
  const { firstDate, lastDate } = dates;
  const days = daysBetween(value.from, value.to) + 1;

  return (
    <aside className="analytics-filters" aria-labelledby="analytics-filters-title">
      <div className="analytics-filters__header">
        <h2 id="analytics-filters-title">Filters</h2>
        <button type="button" className="link-button" onClick={onReset} disabled={isDefault}>
          Reset
        </button>
      </div>

      <section className="analytics-filters__group" aria-labelledby="analytics-filters-period">
        <h3 id="analytics-filters-period">Date range</h3>
        <p className="analytics-filters__summary">
          {formatDate(value.from)} – {formatDate(value.to)}
          <span className="muted">
            {days.toLocaleString()} {days === 1 ? 'day' : 'days'}
          </span>
        </p>
        <DateRangeFields value={value} min={firstDate} max={lastDate} onChange={onChange} />
        {firstDate && lastDate && firstDate < lastDate ? (
          <DateRangeSlider min={firstDate} max={lastDate} value={value} onChange={onChange} />
        ) : (
          <p className="muted analytics-filters__note">
            {firstDate
              ? 'All your sales and expenses are on one day, so there is nothing to slide.'
              : 'The slider appears once you have sales or expenses.'}
          </p>
        )}
      </section>

      <section className="analytics-filters__group" aria-labelledby="analytics-filters-channel">
        <h3 id="analytics-filters-channel">Sales channel</h3>
        <div className="analytics-filters__field">
          <label htmlFor="analytics-filter-channel">Channel</label>
          <select
            id="analytics-filter-channel"
            value={channelId}
            disabled={!channels}
            onChange={(event) => onChannelChange(event.target.value)}
            aria-describedby="analytics-filter-channel-note"
          >
            <option value="">All channels</option>
            {channels?.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
          {channelsError && <p className="field-error">{channelsError}</p>}
        </div>
        <p id="analytics-filter-channel-note" className="muted analytics-filters__note">
          Narrows revenue and sales. Expenses aren't tied to a channel, so they always show in full.
        </p>
      </section>
    </aside>
  );
}

type Field = keyof DateRange;

interface DateRangeFieldsProps {
  value: DateRange;
  /** The first and last day with records; dates outside them are refused. Null when there are none. */
  min: string | null;
  max: string | null;
  onChange: (next: DateRange) => void;
}

/**
 * Start and End date fields. A complete, valid period applies as soon as it's entered; while it
 * isn't one (half-typed, outside the records, or backwards), nothing changes, and the problem is
 * shown once the field loses focus.
 */
function DateRangeFields({ value, min, max, onChange }: DateRangeFieldsProps) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  // A period set from outside (the slider, Reset) replaces whatever was typed.
  if (shown !== value) {
    setShown(value);
    setDraft(value);
    setErrors({});
  }

  function problem(period: DateRange, field: Field): string | undefined {
    const date = period[field];
    if (!isDateKey(date)) return 'Enter a full date';
    if (min && date < min) return `Your records start on ${formatDate(min)}`;
    if (max && date > max) return `Your records end on ${formatDate(max)}`;
    if (period.from > period.to) {
      return field === 'from'
        ? 'Must be on or before the end date'
        : 'Must be on or after the start date';
    }
    return undefined;
  }

  function change(field: Field, input: string) {
    const next = { ...draft, [field]: input };
    setDraft(next);
    if (!problem(next, 'from') && !problem(next, 'to')) {
      setErrors({});
      onChange(next);
    } else if (errors[field]) {
      // Once a field shows a problem, keep it in step with what's typed.
      setErrors({ ...errors, [field]: problem(next, field) });
    }
  }

  return (
    <div className="analytics-filters__fields">
      {(['from', 'to'] as const).map((field) => {
        const id = `analytics-filter-${field}`;
        const error = errors[field];
        // The date pickers also grey out days that would make the period backwards.
        const other = field === 'from' ? draft.to : draft.from;
        const otherValid = isDateKey(other);
        return (
          <div key={field} className="analytics-filters__field">
            <label htmlFor={id}>{field === 'from' ? 'Start date' : 'End date'}</label>
            <input
              id={id}
              type="date"
              value={draft[field]}
              min={(field === 'to' && otherValid ? other : min) ?? undefined}
              max={(field === 'from' && otherValid ? other : max) ?? undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => change(field, event.target.value)}
              onBlur={() =>
                setErrors((current) => ({ ...current, [field]: problem(draft, field) }))
              }
            />
            {error && (
              <p id={`${id}-error`} className="field-error">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
