import { useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../../api/http';
import { listItemTags } from '../../api/items';
import type { ItemTagCount } from '../../types';

interface TagFilterProps {
  /** The ticked tags; empty means every item. */
  value: string[];
  onChange: (tags: string[]) => void;
}

/** "All tags", the one ticked tag, or how many are ticked. */
function summary(tags: string[]): string {
  if (tags.length === 0) return 'All tags';
  return tags.length === 1 ? tags[0] : `${tags.length} tags`;
}

/**
 * Inventory's tag filter: a button that opens a checklist of the tags in use, each with how many
 * items have it. Ticking several keeps items with any of them.
 */
export function TagFilter({ value, onChange }: TagFilterProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<ItemTagCount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Fetched each time it opens, so tags added, renamed or removed since then are current.
    let cancelled = false;
    listItemTags()
      .then((list) => {
        if (!cancelled) setTags(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      });

    const onMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggleOpen() {
    if (!open) setError(null);
    setOpen(!open);
  }

  function toggleTag(tag: string, checked: boolean) {
    onChange(checked ? [...value, tag] : value.filter((ticked) => ticked !== tag));
  }

  // A ticked tag that's no longer in use (renamed or removed meanwhile) stays listed, so it can be
  // unticked.
  const options = [
    ...(tags ?? []),
    ...value
      .filter((tag) => !tags?.some((option) => option.name === tag))
      .map((name) => ({ name, itemCount: 0 })),
  ];

  return (
    <div className="filter-field tag-filter" ref={wrapperRef}>
      <span id="inventory-tag-filter-label">Tags</span>
      <button
        ref={buttonRef}
        id="inventory-tag-filter-button"
        type="button"
        className="tag-filter__button"
        aria-labelledby="inventory-tag-filter-label inventory-tag-filter-button"
        aria-expanded={open}
        aria-controls="inventory-tag-filter-panel"
        onClick={toggleOpen}
      >
        {summary(value)}
      </button>
      {open && (
        <div
          id="inventory-tag-filter-panel"
          className="tag-filter__panel"
          role="group"
          aria-label="Filter items by tag"
        >
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {!error && tags === null && <p className="muted">Loading…</p>}
          {!error && tags !== null && options.length === 0 && (
            <p className="muted">No tags yet. Tag your items to filter by them.</p>
          )}
          {options.length > 0 && (
            <ul className="tag-filter__list">
              {options.map((option) => (
                <li key={option.name}>
                  <label>
                    <input
                      type="checkbox"
                      checked={value.includes(option.name)}
                      onChange={(event) => toggleTag(option.name, event.target.checked)}
                      aria-label={`${option.name} (${option.itemCount} ${option.itemCount === 1 ? 'item' : 'items'})`}
                    />
                    <span>{option.name}</span>
                    <span className="muted" aria-hidden="true">
                      {option.itemCount}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {value.length > 0 && (
            <button type="button" className="link-button" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
