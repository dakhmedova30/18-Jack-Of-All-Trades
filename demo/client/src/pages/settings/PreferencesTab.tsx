import { useEffect, useState, type FormEvent } from 'react';
import { createChannel, deleteChannel, listChannels, renameChannel } from '../../api/channels';
import {
  createExpenseTag,
  deleteExpenseTag,
  listExpenseTags,
  renameExpenseTag,
} from '../../api/expenseTags';
import { getErrorMessage } from '../../api/http';
import { deleteItemTag, listItemTags, renameItemTag } from '../../api/items';
import { useAuth } from '../../hooks/useAuth';
import { MAX_ROWS_PER_PAGE, MIN_ROWS_PER_PAGE, usePreferences } from '../../hooks/usePreferences';
import type { Channel, ExpenseTag, ItemTagCount } from '../../types';
import { DATE_FORMAT_LABELS, type DateFormat } from '../../utils/date';
import { ManagedList } from './ManagedList';
import { SettingsRow } from './SettingsRow';

function SalesChannels({
  channels,
  setChannels,
  error,
}: {
  channels: Channel[] | null;
  setChannels: (update: (current: Channel[] | null) => Channel[] | null) => void;
  error: string | null;
}) {
  const { preferences, update } = usePreferences();
  return (
    <ManagedList
      noun="channel"
      entries={channels}
      loadError={error}
      deleteWarning="This can't be undone."
      onAdd={async (name) => {
        const created = await createChannel(name);
        setChannels((current) => [...(current ?? []), created]);
      }}
      onRename={async (entryId, name) => {
        const id = Number(entryId);
        const renamed = await renameChannel(id, name);
        setChannels((current) => current?.map((c) => (c.id === id ? renamed : c)) ?? null);
      }}
      onDelete={async (entryId) => {
        const id = Number(entryId);
        await deleteChannel(id);
        setChannels((current) => current?.filter((c) => c.id !== id) ?? null);
        if (preferences.defaultChannelId === id) update({ defaultChannelId: null });
      }}
    />
  );
}

function ExpenseTags({
  tags,
  setTags,
  error,
}: {
  tags: ExpenseTag[] | null;
  setTags: (update: (current: ExpenseTag[] | null) => ExpenseTag[] | null) => void;
  error: string | null;
}) {
  const { preferences, update } = usePreferences();
  return (
    <ManagedList
      noun="tag"
      entries={tags}
      loadError={error}
      deleteWarning="Expenses already tagged with it keep the tag."
      onAdd={async (name) => {
        const created = await createExpenseTag(name);
        setTags((current) => [...(current ?? []), created]);
      }}
      onRename={async (entryId, name) => {
        const id = Number(entryId);
        const old = tags?.find((t) => t.id === id)?.name;
        const renamed = await renameExpenseTag(id, name);
        setTags((current) => current?.map((t) => (t.id === id ? renamed : t)) ?? null);
        // The default is kept by name, so follow the rename.
        if (old !== undefined && preferences.defaultExpenseTag === old) {
          update({ defaultExpenseTag: renamed.name });
        }
      }}
      onDelete={async (entryId) => {
        const id = Number(entryId);
        const old = tags?.find((t) => t.id === id)?.name;
        await deleteExpenseTag(id);
        setTags((current) => current?.filter((t) => t.id !== id) ?? null);
        if (old !== undefined && preferences.defaultExpenseTag === old) {
          update({ defaultExpenseTag: null });
        }
      }}
    />
  );
}

/**
 * The tags used on inventory items. They exist only while an item has them, so there's no Add:
 * you create one by typing it on an item. Renaming changes it on every item; deleting removes it
 * from every item (the items stay).
 */
function InventoryTags({
  tags,
  reload,
  error,
}: {
  tags: ItemTagCount[] | null;
  reload: () => Promise<void>;
  error: string | null;
}) {
  const count = (name: string | number) => tags?.find((tag) => tag.name === name)?.itemCount ?? 0;
  const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;
  return (
    <ManagedList
      noun="inventory tag"
      entries={
        tags?.map((tag) => ({ id: tag.name, name: tag.name, detail: items(tag.itemCount) })) ?? null
      }
      loadError={error}
      deleteWarning={(entry) => `Removes it from ${items(count(entry.id))}. The items stay.`}
      onRename={async (id, name) => {
        await renameItemTag(String(id), name);
        await reload(); // renaming onto an existing tag merges two, so refetch the counts
      }}
      onDelete={async (id) => {
        await deleteItemTag(String(id));
        await reload();
      }}
    />
  );
}

/** "Low stock" cutoff: items at or below this quantity are flagged. Saved on the server. */
function LowStockThreshold() {
  const { business, updateBusiness } = useAuth();
  const [value, setValue] = useState(String(business?.lowStockThreshold ?? 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!business) return null;

  const parsed = Number(value);
  const valid = value.trim() !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000;
  const changed = valid && parsed !== business.lowStockThreshold;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return setError('Enter a whole number, 0 or more');
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateBusiness({ lowStockThreshold: parsed });
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-stack" onSubmit={handleSubmit} noValidate>
      <SettingsRow label="Low-stock threshold">
        <input
          className="settings-row__input settings-row__input--short"
          type="number"
          min={0}
          step={1}
          aria-label="Low-stock threshold"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
        />
        <button type="submit" className="button" disabled={!changed || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="muted">Saved.</span>}
      </SettingsRow>
      <p className="muted settings-row__error">
        Items with this many or fewer in stock show up as low stock on Home and Inventory.
      </p>
      {error && <p className="form-error settings-row__error">{error}</p>}
    </form>
  );
}

/** How many rows the Inventory, Sales and Expenses tables show per page: a whole number 1 to 100. */
function RowsPerPage() {
  const { preferences, update } = usePreferences();
  const [value, setValue] = useState(String(preferences.rowsPerPage));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmed = value.trim();
  const parsed = Number(trimmed);
  // Digits only: rejects empty, "2.5", "-3" and "1e2" before looking at the range.
  const wholeNumber = /^\d+$/.test(trimmed);
  const inRange = wholeNumber && parsed >= MIN_ROWS_PER_PAGE && parsed <= MAX_ROWS_PER_PAGE;
  const changed = inRange && parsed !== preferences.rowsPerPage;

  function problem(): string | null {
    if (!trimmed) return 'Enter a number';
    if (!wholeNumber) return 'Use a whole number, like 20';
    if (!inRange) return `Choose a number from ${MIN_ROWS_PER_PAGE} to ${MAX_ROWS_PER_PAGE}`;
    return null;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = problem();
    setError(found);
    if (found) return;
    update({ rowsPerPage: parsed });
    setSaved(true);
  }

  return (
    <form className="settings-stack" onSubmit={handleSubmit} noValidate>
      <SettingsRow label="Rows per page">
        <input
          className="settings-row__input settings-row__input--short"
          type="text"
          inputMode="numeric"
          aria-label="Rows per page"
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
            // Once an error is showing, keep it in step with what's typed.
            if (error) setError(null);
          }}
        />
        <button type="submit" className="button" disabled={!changed}>
          Save
        </button>
        {saved && <span className="muted">Saved.</span>}
      </SettingsRow>
      <p className="muted settings-row__error">
        {MIN_ROWS_PER_PAGE} to {MAX_ROWS_PER_PAGE}. Applies to Inventory, Sales and Expenses.
      </p>
      {error && <p className="form-error settings-row__error">{error}</p>}
    </form>
  );
}

export function PreferencesTab() {
  const { preferences, update } = usePreferences();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [tags, setTags] = useState<ExpenseTag[] | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [itemTags, setItemTags] = useState<ItemTagCount[] | null>(null);
  const [itemTagsError, setItemTagsError] = useState<string | null>(null);

  async function reloadItemTags() {
    try {
      setItemTags(await listItemTags());
    } catch (error) {
      setItemTagsError(getErrorMessage(error));
    }
  }

  useEffect(() => {
    listItemTags()
      .then(setItemTags)
      .catch((error: unknown) => setItemTagsError(getErrorMessage(error)));
    listChannels()
      .then(setChannels)
      .catch((error: unknown) => setChannelsError(getErrorMessage(error)));
    listExpenseTags()
      .then(setTags)
      .catch((error: unknown) => setTagsError(getErrorMessage(error)));
  }, []);

  return (
    <>
      <h3 className="settings-section">Sales channels</h3>
      <p className="muted">
        Where your sales happen. A channel that has sales can be renamed but not deleted.
      </p>
      <SalesChannels channels={channels} setChannels={setChannels} error={channelsError} />

      <h3 className="settings-section">Expense tags</h3>
      <p className="muted">
        The choices in the Tag dropdown when you add an expense. Renaming a tag updates your past
        expenses too.
      </p>
      <ExpenseTags tags={tags} setTags={setTags} error={tagsError} />

      <h3 className="settings-section">Inventory tags</h3>
      <p className="muted">
        The tags on your inventory items. Rename one to change it on every item, or delete one to
        remove it from every item. New tags are created by typing them on an item.
      </p>
      <InventoryTags tags={itemTags} reload={reloadItemTags} error={itemTagsError} />

      <h3 className="settings-section">Low stock</h3>
      <LowStockThreshold />

      <h3 className="settings-section">Display</h3>
      <p className="muted">These are saved in this browser.</p>
      <SettingsRow label="Date format">
        <select
          className="settings-row__input"
          aria-label="Date format"
          value={preferences.dateFormat}
          onChange={(event) => update({ dateFormat: event.target.value as DateFormat })}
        >
          {(Object.keys(DATE_FORMAT_LABELS) as DateFormat[]).map((format) => (
            <option key={format} value={format}>
              {DATE_FORMAT_LABELS[format]}
            </option>
          ))}
        </select>
      </SettingsRow>
      <RowsPerPage />

      <h3 className="settings-section">Form defaults</h3>
      <p className="muted">Pre-filled when you add something new. Saved in this browser.</p>
      <SettingsRow label="Default sales channel">
        <select
          className="settings-row__input"
          aria-label="Default sales channel"
          value={preferences.defaultChannelId ?? ''}
          onChange={(event) =>
            update({ defaultChannelId: event.target.value ? Number(event.target.value) : null })
          }
          disabled={!channels}
        >
          <option value="">None</option>
          {channels?.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </SettingsRow>
      <SettingsRow label="Default expense tag">
        <select
          className="settings-row__input"
          aria-label="Default expense tag"
          value={preferences.defaultExpenseTag ?? ''}
          onChange={(event) => update({ defaultExpenseTag: event.target.value || null })}
          disabled={!tags}
        >
          <option value="">None</option>
          {tags?.map((tag) => (
            <option key={tag.id} value={tag.name}>
              {tag.name}
            </option>
          ))}
        </select>
      </SettingsRow>
    </>
  );
}
