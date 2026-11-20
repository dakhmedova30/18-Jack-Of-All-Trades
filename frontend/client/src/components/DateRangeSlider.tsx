import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { DateRange } from '../types';
import { addDays, daysBetween, formatDate } from '../utils/date';

interface DateRangeSliderProps {
  /** The slider's two ends, "YYYY-MM-DD"; `max` must be after `min`. */
  min: string;
  max: string;
  value: DateRange;
  onChange: (next: DateRange) => void;
}

type Part = 'from' | 'to' | 'window';

interface Drag {
  part: Part;
  /** Where the pointer and the period were when the drag started; used to slide the window. */
  startX: number;
  from: number;
  to: number;
}

/** Page Up / Page Down move this many days; the arrow keys move one. */
const PAGE_DAYS = 30;
/** Year labels closer than this (as a fraction of the track) to an end or to each other are left out. */
const MIN_LABEL_GAP = 0.14;

function keyStep(key: string): number | null {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      return -1;
    case 'ArrowRight':
    case 'ArrowUp':
      return 1;
    case 'PageDown':
      return -PAGE_DAYS;
    case 'PageUp':
      return PAGE_DAYS;
    default:
      return null;
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Each Jan 1 after `min` up to `max`, as a fraction of the way along, for the tick marks. */
function yearTicks(min: string, max: string, span: number) {
  const ticks: { year: number; at: number; labelled: boolean }[] = [];
  let lastLabel = 0;
  for (let year = Number(min.slice(0, 4)) + 1; year <= Number(max.slice(0, 4)); year++) {
    const at = daysBetween(min, `${year}-01-01`) / span;
    const labelled = at - lastLabel >= MIN_LABEL_GAP && 1 - at >= MIN_LABEL_GAP;
    if (labelled) lastLabel = at;
    ticks.push({ year, at, labelled });
  }
  return ticks;
}

/**
 * Picks a period between `min` and `max`, in whole days. The two handles move its start and end;
 * dragging the shaded part between them slides the whole period along, keeping its length; and
 * pressing the bare track moves the nearer handle there. Every part works from the keyboard too:
 * the arrow keys move a day, Page Up / Page Down 30 days, Home / End as far as it can go.
 */
export function DateRangeSlider({ min, max, value, onChange }: DateRangeSliderProps) {
  const span = daysBetween(min, max);
  const from = clamp(daysBetween(min, value.from), 0, span);
  const to = clamp(daysBetween(min, value.to), from, span);
  const trackRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  const percent = (day: number) => `${(day / span) * 100}%`;
  const fromText = formatDate(addDays(min, from));
  const toText = formatDate(addDays(min, to));
  // When the handles meet at the right end, the start one must be on top, or it couldn't be dragged back.
  const fromOnTop = from > span / 2;

  function set(nextFrom: number, nextTo: number) {
    if (nextFrom !== from || nextTo !== to) {
      onChange({ from: addDays(min, nextFrom), to: addDays(min, nextTo) });
    }
  }

  function trackWidth(): number {
    return trackRef.current?.getBoundingClientRect().width || 1;
  }

  /** The day under `clientX`, held to the track. */
  function dayAt(clientX: number): number {
    const left = trackRef.current?.getBoundingClientRect().left ?? 0;
    return Math.round(clamp((clientX - left) / trackWidth(), 0, 1) * span);
  }

  function startDrag(event: PointerEvent<HTMLElement>, part: Part) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { part, startX: event.clientX, from, to };
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current) return;
    if (current.part === 'from') {
      set(Math.min(dayAt(event.clientX), to), to);
    } else if (current.part === 'to') {
      set(from, Math.max(dayAt(event.clientX), from));
    } else {
      const length = current.to - current.from;
      const shift = Math.round(((event.clientX - current.startX) / trackWidth()) * span);
      const nextFrom = clamp(current.from + shift, 0, span - length);
      set(nextFrom, nextFrom + length);
    }
  }

  function endDrag() {
    drag.current = null;
  }

  /** A press on the bare track moves the nearer handle there, and keeps dragging it. */
  function pressTrack(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    // Stops the press from taking focus away from the handle focused below.
    event.preventDefault();
    const day = dayAt(event.clientX);
    const part = day < from ? 'from' : day > to ? 'to' : day - from <= to - day ? 'from' : 'to';
    if (part === 'from') set(day, to);
    else set(from, day);
    (part === 'from' ? fromRef : toRef).current?.focus();
    startDrag(event, part);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, part: Part) {
    const length = to - from;
    const step = keyStep(event.key);
    let next: [number, number];
    if (step !== null) {
      if (part === 'from') next = [clamp(from + step, 0, to), to];
      else if (part === 'to') next = [from, clamp(to + step, from, span)];
      else {
        const nextFrom = clamp(from + step, 0, span - length);
        next = [nextFrom, nextFrom + length];
      }
    } else if (event.key === 'Home') {
      next = part === 'to' ? [from, from] : [0, part === 'window' ? length : to];
    } else if (event.key === 'End') {
      next = part === 'from' ? [to, to] : [part === 'window' ? span - length : from, span];
    } else {
      return;
    }
    event.preventDefault();
    set(...next);
  }

  const ticks = yearTicks(min, max, span);

  return (
    <div className="range-slider">
      <div
        ref={trackRef}
        className="range-slider__track"
        onPointerDown={pressTrack}
        // A dragged handle captures the pointer, and its moves bubble up to here.
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {ticks.map((tick) => (
          <span
            key={tick.year}
            className="range-slider__tick"
            style={{ left: `${tick.at * 100}%` }}
          />
        ))}
        <div
          ref={fromRef}
          role="slider"
          tabIndex={0}
          className={`range-slider__thumb${fromOnTop ? ' range-slider__thumb--top' : ''}`}
          style={{ left: percent(from) }}
          aria-label="Start date"
          aria-valuemin={0}
          aria-valuemax={to}
          aria-valuenow={from}
          aria-valuetext={fromText}
          onPointerDown={(event) => startDrag(event, 'from')}
          onKeyDown={(event) => handleKeyDown(event, 'from')}
        />
        <div
          role="slider"
          tabIndex={0}
          className="range-slider__window"
          style={{ left: percent(from), width: percent(to - from) }}
          aria-label="Selected period"
          aria-valuemin={0}
          aria-valuemax={span - (to - from)}
          aria-valuenow={from}
          aria-valuetext={`${fromText} to ${toText}`}
          title="Drag to move the whole period"
          onPointerDown={(event) => startDrag(event, 'window')}
          onKeyDown={(event) => handleKeyDown(event, 'window')}
        />
        <div
          ref={toRef}
          role="slider"
          tabIndex={0}
          className="range-slider__thumb"
          style={{ left: percent(to) }}
          aria-label="End date"
          aria-valuemin={from}
          aria-valuemax={span}
          aria-valuenow={to}
          aria-valuetext={toText}
          onPointerDown={(event) => startDrag(event, 'to')}
          onKeyDown={(event) => handleKeyDown(event, 'to')}
        />
      </div>
      <div className="range-slider__scale" aria-hidden="true">
        <span>{formatDate(min)}</span>
        {ticks
          .filter((tick) => tick.labelled)
          .map((tick) => (
            <span
              key={tick.year}
              className="range-slider__year"
              style={{ left: `${tick.at * 100}%` }}
            >
              {tick.year}
            </span>
          ))}
        <span>{formatDate(max)}</span>
      </div>
    </div>
  );
}
