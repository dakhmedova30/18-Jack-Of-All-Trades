import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/http';

type EntryId = number | string;

interface Entry {
  id: EntryId;
  name: string;
  /** Small grey text after the name, e.g. "3 items". */
  detail?: string;
}

interface ManagedListProps {
  /** "channel" or "tag": used in labels and messages. */
  noun: string;
  entries: Entry[] | null;
  loadError: string | null;
  /** Leave out when entries can't be added here (e.g. tags only exist once an item uses them). */
  onAdd?: (name: string) => Promise<void>;
  onRename: (id: EntryId, name: string) => Promise<void>;
  onDelete: (id: EntryId) => Promise<void>;
  /** Shown in the delete confirmation, after the name. */
  deleteWarning: string | ((entry: Entry) => string);
}

/** A list of names you can add to, rename and delete, with inline errors from the server. */
export function ManagedList({
  noun,
  entries,
  loadError,
  onAdd,
  onRename,
  onDelete,
  deleteWarning,
}: ManagedListProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<EntryId | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmingId, setConfirmingId] = useState<EntryId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, onSuccess: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return setError('Enter a name');
    if (!onAdd) return;
    void run(
      () => onAdd(name),
      () => setNewName(''),
    );
  }

  function handleRename(event: FormEvent, entry: Entry) {
    event.preventDefault();
    const name = editName.trim();
    if (!name) return setError('Enter a name');
    if (name === entry.name) return setEditingId(null);
    void run(
      () => onRename(entry.id, name),
      () => setEditingId(null),
    );
  }

  return (
    <>
      {loadError && <p className="form-error">{loadError}</p>}
      {!entries && !loadError && <p className="muted">Loading…</p>}
      {entries && (
        <ul className="settings-list">
          {entries.map((entry) => (
            <li key={entry.id} className="settings-list__item">
              {editingId === entry.id ? (
                <form className="settings-inline" onSubmit={(event) => handleRename(event, entry)}>
                  <input
                    className="settings-row__input"
                    aria-label={`New name for ${entry.name}`}
                    value={editName}
                    maxLength={40}
                    onChange={(event) => setEditName(event.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="button" disabled={busy}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </form>
              ) : confirmingId === entry.id ? (
                <div className="settings-inline">
                  <span>
                    Delete “{entry.name}”?{' '}
                    {typeof deleteWarning === 'function' ? deleteWarning(entry) : deleteWarning}
                  </span>
                  <button
                    type="button"
                    className="button button--danger"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => onDelete(entry.id),
                        () => setConfirmingId(null),
                      )
                    }
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={busy}
                    onClick={() => setConfirmingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span>
                    {entry.name}
                    {entry.detail && (
                      <span className="muted settings-list__detail">{entry.detail}</span>
                    )}
                  </span>
                  <span className="settings-inline">
                    <button
                      type="button"
                      className="button button--secondary"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setConfirmingId(null);
                        setEditName(entry.name);
                        setEditingId(entry.id);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="button button--secondary"
                      disabled={busy}
                      onClick={() => {
                        setError(null);
                        setEditingId(null);
                        setConfirmingId(entry.id);
                      }}
                    >
                      Delete
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {onAdd && (
        <form className="settings-inline" onSubmit={handleAdd} noValidate>
          <input
            className="settings-row__input"
            aria-label={`New ${noun} name`}
            placeholder={`Add a ${noun}`}
            value={newName}
            maxLength={40}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button type="submit" className="button" disabled={busy}>
            Add
          </button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
