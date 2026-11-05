import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getNotificationSettings, saveNotificationSettings } from '../../api/notifications';
import { getErrorMessage } from '../../api/http';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import type { Business, NotificationSettings } from '../../types';

interface Limits {
  min: number;
  max: number;
}

const THRESHOLD: Limits = { min: 0, max: 100000 };
const DAYS: Limits = { min: 1, max: 365 };
const PERCENT: Limits = { min: 1, max: 1000 };

/** A whole number within the limits, or the message to show: digits only, then the range. */
function check(raw: string, { min, max }: Limits): string | null {
  const text = raw.trim();
  if (!text) return 'Enter a number';
  if (!/^\d+$/.test(text)) return 'Use a whole number';
  const value = Number(text);
  if (value < min || value > max) return `Choose a number from ${min} to ${max}`;
  return null;
}

interface AlertRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** The number that triggers the alert, e.g. "after [3] days"; left out when there isn't one. */
  children?: ReactNode;
  error?: string | null;
}

function AlertRow({ label, description, enabled, onToggle, children, error }: AlertRowProps) {
  return (
    <div className="notify-row">
      <label className="notify-row__toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span className="notify-row__text">
          <strong>{label}</strong>
          <span className="muted">{description}</span>
        </span>
      </label>
      {children && <div className="notify-row__number">{children}</div>}
      {error && <p className="form-error notify-row__error">{error}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  invalid,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  disabled: boolean;
}) {
  return (
    <input
      className="settings-row__input settings-row__input--short"
      type="text"
      inputMode="numeric"
      aria-label={label}
      aria-invalid={invalid ? true : undefined}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function NotificationsForm({
  saved,
  onSaved,
  business,
}: {
  saved: NotificationSettings;
  onSaved: (settings: NotificationSettings) => void;
  business: Business;
}) {
  const { updateBusiness } = useAuth();
  const { reload, showDismissed } = useNotifications();
  const [lowStock, setLowStock] = useState(saved.lowStock);
  const [outOfStock, setOutOfStock] = useState(saved.outOfStock);
  const [newDevice, setNewDevice] = useState(saved.newDevice);
  const [noSales, setNoSales] = useState(saved.noSales);
  const [expenseSpike, setExpenseSpike] = useState(saved.expenseSpike);
  const [threshold, setThreshold] = useState(String(business.lowStockThreshold));
  const [days, setDays] = useState(String(saved.noSalesDays));
  const [percent, setPercent] = useState(String(saved.expenseSpikePercent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const thresholdError = check(threshold, THRESHOLD);
  const daysError = check(days, DAYS);
  const percentError = check(percent, PERCENT);
  const valid = !thresholdError && !daysError && !percentError;

  const changed =
    lowStock !== saved.lowStock ||
    outOfStock !== saved.outOfStock ||
    newDevice !== saved.newDevice ||
    noSales !== saved.noSales ||
    expenseSpike !== saved.expenseSpike ||
    threshold.trim() !== String(business.lowStockThreshold) ||
    days.trim() !== String(saved.noSalesDays) ||
    percent.trim() !== String(saved.expenseSpikePercent);

  /** Wraps a setter so editing clears the "Saved." note. */
  function edit<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setJustSaved(false);
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const next = await saveNotificationSettings({
        lowStock,
        outOfStock,
        newDevice,
        noSales,
        noSalesDays: Number(days),
        expenseSpike,
        expenseSpikePercent: Number(percent),
      });
      // The low-stock number belongs to the business (it also drives Inventory and Home).
      if (Number(threshold) !== business.lowStockThreshold) {
        await updateBusiness({ lowStockThreshold: Number(threshold) });
      }
      onSaved(next);
      reload();
      setJustSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-stack" onSubmit={handleSubmit} noValidate>
      <AlertRow
        label="Low stock"
        description="Items that are running low but not out."
        enabled={lowStock}
        onToggle={edit(setLowStock)}
        error={thresholdError}
      >
        Alert when an item has{' '}
        <NumberField
          label="Low-stock threshold"
          value={threshold}
          onChange={edit(setThreshold)}
          invalid={!!thresholdError}
          disabled={!lowStock}
        />{' '}
        or fewer in stock. This is the same number as on Home and Inventory.
      </AlertRow>

      <AlertRow
        label="Out of stock"
        description="Items with none left."
        enabled={outOfStock}
        onToggle={edit(setOutOfStock)}
      />

      <AlertRow
        label="New device login"
        description="Someone logged in from a browser you haven't used before."
        enabled={newDevice}
        onToggle={edit(setNewDevice)}
      />

      <AlertRow
        label="No recent sales"
        description="A nudge to record your sales."
        enabled={noSales}
        onToggle={edit(setNoSales)}
        error={daysError}
      >
        Alert when no sale has been recorded for{' '}
        <NumberField
          label="Days without a sale"
          value={days}
          onChange={edit(setDays)}
          invalid={!!daysError}
          disabled={!noSales}
        />{' '}
        days.
      </AlertRow>

      <AlertRow
        label="Expense spike"
        description="Spending is running well ahead of last month."
        enabled={expenseSpike}
        onToggle={edit(setExpenseSpike)}
        error={percentError}
      >
        Alert when this month's expenses so far are more than{' '}
        <NumberField
          label="Expense increase percent"
          value={percent}
          onChange={edit(setPercent)}
          invalid={!!percentError}
          disabled={!expenseSpike}
        />{' '}
        % above last month's total.
      </AlertRow>

      <div className="settings-inline">
        <button type="submit" className="button" disabled={!changed || !valid || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {justSaved && <span className="muted">Saved.</span>}
      </div>
      {error && <p className="form-error">{error}</p>}

      <p className="muted">
        Alerts show under the bell in the sidebar. Dismissing one only hides it in this browser, and
        it comes back if the situation changes.{' '}
        <button type="button" className="notification-panel__link" onClick={showDismissed}>
          Show dismissed alerts again
        </button>
      </p>
    </form>
  );
}

export function NotificationsTab() {
  const { business } = useAuth();
  const [saved, setSaved] = useState<NotificationSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getNotificationSettings()
      .then(setSaved)
      .catch((err: unknown) => setLoadError(getErrorMessage(err)));
  }, []);

  if (loadError) return <p className="form-error">{loadError}</p>;
  if (!saved || !business) return <p className="muted">Loading…</p>;
  return <NotificationsForm saved={saved} onSaved={setSaved} business={business} />;
}
