import { useEffect, useRef, useState } from 'react';
import { DateRangeSlider } from '../../components/DateRangeSlider';
import type { AnalyticsDateRange, DateRange } from '../../types';
import { daysBetween, formatDate, isDateKey } from '../../utils/date';

/**
 * A menu of checkboxes that narrows a page's charts to some of its options, such as sales channels
 * or expense tags. Ticking none of them, or all of them, narrows nothing.
 */
export interface FilterChoice {
  /** The group's heading, e.g. "Sales channel". */
  heading: string;
  /** The menu button's label, e.g. "Channels". */
  label: string;
  /** What the button says with none or all ticked, and the tick-all option, e.g. "All channels". */
  allLabel: string;
  /** The options' plural, for the button with three or more ticked, e.g. "channels". */
  plural: string;
  /** The options; undefined while they load. */
  options: { value: string; label: string }[] | undefined;
  /** Why the options couldn't load. */
  error: string | undefined;
  /** The ticked options' values, in the options' order; [] for none. */
  value: string[];
  onChange: (value: string[]) => void;
  /** What the choice narrows, under the menu. */
  note: string;
}

interface AnalyticsFiltersProps {
  /** The first and last day with records: the ends of the slider and the limits of the fields. */
  dates: AnalyticsDateRange;
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** A checkbox menu under the dates (Sales' channels, Expenses' tags); none without it. */
  choice?: FilterChoice;
  /** Back to the period the page opened with (and nothing ticked); disabled when `isDefault`. */
  onReset: () => void;
  isDefault: boolean;
}

/**
 * The Analytics filters: the period, set two ways that stay in step (Start and End date fields,
 * and a slider running from the first record to the latest), and on some pages a checkbox menu,
 * such as the sales channels.
 */
export function AnalyticsFilters({
  dates,
  value,
  onChange,
  choice,
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

      {choice && <ChoiceFilter {...choice} />}
    </aside>
  );
}

/**
 * A button that opens a menu of checkboxes, with a tick-all box first (half-ticked when only some
 * are). The menu stays open while boxes are ticked; Escape, a click outside it, or tabbing away
 * closes it.
 */
function ChoiceFilter({
  heading,
  label,
  allLabel,
  plural,
  options,
  error,
  value,
  onChange,
  note,
}: FilterChoice) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const allRef = useRef<HTMLInputElement>(null);

  const choices = options ?? [];
  const ticked = choices.filter((option) => value.includes(option.value));
  const every = choices.length > 0 && ticked.length === choices.length;
  const some = ticked.length > 0 && !every;
  const summary =
    ticked.length === 0 || every
      ? allLabel
      : ticked.length <= 2
        ? ticked.map((option) => option.label).join(', ')
        : `${ticked.length} ${plural}`;

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  // "Half-ticked" exists only as a DOM property, not an attribute.
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  });

  function toggle(option: string) {
    const next = new Set(value);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange(choices.filter((choice) => next.has(choice.value)).map((choice) => choice.value));
  }

  return (
    <section className="analytics-filters__group" aria-labelledby="analytics-filters-choice">
      <h3 id="analytics-filters-choice">{heading}</h3>
      <div
        ref={rootRef}
        className="analytics-filters__field choice-menu"
        onBlur={(event) => {
          // Tabbing past the menu closes it; clicks inside it (on no box) leave it open.
          const next = event.relatedTarget;
          if (next && !event.currentTarget.contains(next)) setOpen(false);
        }}
      >
        <span id="analytics-filter-choice-label" className="choice-menu__label">
          {label}
        </span>
        <button
          ref={buttonRef}
          id="analytics-filter-choice"
          type="button"
          className="choice-menu__button"
          aria-labelledby="analytics-filter-choice-label analytics-filter-choice"
          aria-describedby="analytics-filter-choice-note"
          aria-expanded={open}
          aria-controls="analytics-filter-choice-menu"
          disabled={!options}
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          <span className="choice-menu__summary">{summary}</span>
          <span className="choice-menu__chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        {open && (
          <fieldset id="analytics-filter-choice-menu" className="choice-menu__menu">
            <legend className="visually-hidden">{label}</legend>
            <label className="choice-menu__option choice-menu__option--all">
              <input
                ref={allRef}
                type="checkbox"
                checked={every}
                onChange={() => onChange(every ? [] : choices.map((option) => option.value))}
              />
              {allLabel}
            </label>
            {choices.map((option) => (
              <label key={option.value} className="choice-menu__option">
                <input
                  type="checkbox"
                  checked={value.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <p className="field-error">
            Couldn't load the {plural}: {error}
          </p>
        )}
      </div>
      <p id="analytics-filter-choice-note" className="muted analytics-filters__note">
        {note}
      </p>
    </section>
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
