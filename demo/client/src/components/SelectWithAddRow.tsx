import { useState } from 'react';
import { getErrorMessage } from '../api/http';
import { PlusIcon } from './icons';

interface SelectWithAddRowProps {
  /** Base id for the select; the "new" input gets `${id}-new`. */
  id: string;
  label: string;
  /** Lowercase name of one entry, for the button and messages: "channel", "tag". */
  noun: string;
  /** null while loading. */
  options: { value: string; label: string }[] | null;
  loadError: string | null;
  value: string;
  onChange: (value: string) => void;
  /** Saves a new entry and resolves to its option value, which then gets selected. */
  onAdd: (name: string) => Promise<string>;
  /** A validation message from the form, e.g. "Pick a channel". */
  error: string | null;
  maxLength: number;
  placeholder: string;
}

/**
 * A form row with a dropdown and a "+ New …" button. The button swaps the
 * dropdown for an inline name input; adding saves right away and selects it.
 */
export function SelectWithAddRow({
  id,
  label,
  noun,
  options,
  loadError,
  value,
  onChange,
  onAdd,
  error,
  maxLength,
  placeholder,
}: SelectWithAddRowProps) {
  // null = not adding; a string = the "New" input is open with this text.
  const [newName, setNewName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleAdd() {
    const name = newName?.trim() ?? '';
    if (!name) {
      setAddError(`Enter a ${noun} name`);
      return;
    }
    setAdding(true);
    try {
      onChange(await onAdd(name));
      setNewName(null);
      setAddError(null);
    } catch (caught) {
      setAddError(getErrorMessage(caught));
    } finally {
      setAdding(false);
    }
  }

  function closeNew() {
    setNewName(null);
    setAddError(null);
  }

  const shownError = addError ?? error;

  return (
    <div className="form-row">
      <label htmlFor={newName === null ? id : `${id}-new`}>{label}</label>
      <div className="form-row__control">
        {loadError && (
          <span className="form-error">
            Could not load {noun}s: {loadError}
          </span>
        )}
        {!options && !loadError && <span className="muted">Loading {noun}s…</span>}

        {options && newName === null && (
          <div className="select-add">
            <select
              id={id}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              aria-invalid={shownError ? true : undefined}
            >
              <option value="">Select…</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="link-button select-add__add"
              onClick={() => setNewName('')}
            >
              <PlusIcon /> New {noun}
            </button>
          </div>
        )}

        {options && newName !== null && (
          <div className="select-add">
            <input
              id={`${id}-new`}
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                setAddError(null);
              }}
              onKeyDown={(event) => {
                // Enter adds the entry instead of submitting the whole form.
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder={placeholder}
              maxLength={maxLength}
              autoFocus
              aria-invalid={shownError ? true : undefined}
            />
            <button
              type="button"
              className="button"
              onClick={() => void handleAdd()}
              disabled={adding}
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
            <button type="button" className="button button--ghost" onClick={closeNew}>
              Cancel
            </button>
          </div>
        )}

        {shownError && <span className="field-error">{shownError}</span>}
      </div>
    </div>
  );
}
