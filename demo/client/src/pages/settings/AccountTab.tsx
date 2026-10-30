import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../../api/http';
import { useAuth } from '../../hooks/useAuth';
import type { Business } from '../../types';
import { SettingsRow } from './SettingsRow';

const BUSINESS_TYPES = [
  'Retail',
  'Food & beverage',
  'Handmade & crafts',
  'Clothing & accessories',
  'Health & beauty',
  'Services',
];
/** Choosing this in the type dropdown reveals a text box; what's typed is what gets saved. */
const OTHER = 'Other';
const COUNTRIES = ['Canada', 'United States', 'United Kingdom', 'Australia', 'Other'];
const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'AUD'];

/** Every IANA time zone the browser knows, with UTC first (the server's default). */
const TIME_ZONES = ['UTC', ...Intl.supportedValuesOf('timeZone').filter((zone) => zone !== 'UTC')];

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
}

/** The options, plus the saved value if it isn't one of them (e.g. it was set through the API). */
function withCurrent(options: string[], current: string | null): string[] {
  return current && !options.includes(current) ? [...options, current] : options;
}

function BusinessNameRow() {
  const { business, updateBusiness } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!business) return null;

  function startEditing() {
    setName(business!.name);
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError('Business name is required');
    if (trimmed === business!.name) return setEditing(false);
    setSaving(true);
    try {
      await updateBusiness({ name: trimmed });
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <SettingsRow label="Business name">
        <span className="settings-row__value">{business.name}</span>
        <button type="button" className="button button--secondary" onClick={startEditing}>
          Edit
        </button>
      </SettingsRow>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <SettingsRow label="Business name">
        <input
          className="settings-row__input"
          aria-label="Business name"
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </SettingsRow>
      {error && <p className="form-error settings-row__error">{error}</p>}
    </form>
  );
}

/** The email is the login, so changing it asks for the current password. */
function EmailRow() {
  const { business, changeEmail } = useAuth();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!business) return null;

  function startEditing() {
    setEmail(business!.email);
    setPassword('');
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return setError('Enter a valid email');
    if (!password) return setError('Enter your current password');
    setSaving(true);
    try {
      await changeEmail(email.trim(), password);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <SettingsRow label="Email">
        <span className="settings-row__value">{business.email}</span>
        <button type="button" className="button button--secondary" onClick={startEditing}>
          Change
        </button>
      </SettingsRow>
    );
  }

  return (
    <form className="settings-stack" onSubmit={handleSubmit} noValidate>
      <SettingsRow label="New email">
        <input
          className="settings-row__input"
          type="email"
          aria-label="New email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoFocus
        />
      </SettingsRow>
      <SettingsRow label="Current password">
        <input
          className="settings-row__input"
          type="password"
          aria-label="Current password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </SettingsRow>
      {error && <p className="form-error settings-row__error">{error}</p>}
    </form>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <SettingsRow label={label}>
      <select
        className="settings-row__input"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {allowEmpty && <option value="">Not set</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </SettingsRow>
  );
}

/** Business type, country, time zone and currency, saved together with one button. */
function BusinessDetailsForm({ business }: { business: Business }) {
  const { updateBusiness } = useAuth();
  const [businessType, setBusinessType] = useState(business.businessType ?? '');
  // A saved type that isn't one of the presets was typed in under "Other".
  const [otherType, setOtherType] = useState(
    !!business.businessType && !BUSINESS_TYPES.includes(business.businessType),
  );
  const [country, setCountry] = useState(business.country ?? '');
  const [timeZone, setTimeZone] = useState(business.timeZone);
  const [currency, setCurrency] = useState(business.currency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed =
    businessType.trim() !== (business.businessType ?? '') ||
    country !== (business.country ?? '') ||
    timeZone !== business.timeZone ||
    currency !== business.currency;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedType = businessType.trim();
    // Once a type has been set it can be changed but not cleared.
    if (business.businessType && !trimmedType) {
      return setError('Enter your business type');
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateBusiness({ businessType: trimmedType, country, timeZone, currency });
      setBusinessType(trimmedType);
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function edit(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setSaved(false);
    };
  }

  return (
    <form className="settings-stack" onSubmit={handleSubmit}>
      <SelectRow
        label="Business type"
        value={otherType ? OTHER : businessType}
        options={[...BUSINESS_TYPES, OTHER]}
        onChange={edit((value) => {
          setOtherType(value === OTHER);
          setBusinessType(value === OTHER ? '' : value);
        })}
        allowEmpty={!business.businessType}
      />
      {otherType && (
        <SettingsRow label="">
          <input
            className="settings-row__input"
            aria-label="Your business type"
            placeholder="Type your business type"
            value={businessType}
            maxLength={60}
            onChange={(event) => edit(setBusinessType)(event.target.value)}
            autoFocus
          />
        </SettingsRow>
      )}
      <SelectRow
        label="Country"
        value={country}
        options={withCurrent(COUNTRIES, business.country)}
        onChange={edit(setCountry)}
        allowEmpty
      />
      <SelectRow
        label="Time zone"
        value={timeZone}
        options={withCurrent(TIME_ZONES, business.timeZone)}
        onChange={edit(setTimeZone)}
      />
      <SelectRow
        label="Currency"
        value={currency}
        options={withCurrent(CURRENCIES, business.currency)}
        onChange={edit(setCurrency)}
      />
      <SettingsRow label="">
        <button type="submit" className="button" disabled={!changed || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="muted">Saved.</span>}
      </SettingsRow>
      {error && <p className="form-error settings-row__error">{error}</p>}
    </form>
  );
}

export function AccountTab() {
  const { business } = useAuth();
  if (!business) return null;
  return (
    <>
      <h3 className="settings-section">Business</h3>
      <BusinessNameRow />
      <BusinessDetailsForm business={business} />

      <h3 className="settings-section">Login</h3>
      <EmailRow />

      <h3 className="settings-section">Account info</h3>
      <SettingsRow label="Account ID">{business.id}</SettingsRow>
      <SettingsRow label="Member since">
        {new Date(business.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
      </SettingsRow>
      <SettingsRow label="Last login">{formatDate(business.lastLoginAt)}</SettingsRow>
    </>
  );
}
