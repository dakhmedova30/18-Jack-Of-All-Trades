import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/http';
import { changePassword, logOutOtherSessions } from '../../api/security';
import { useAuth } from '../../hooks/useAuth';
import { useSecurityInfo } from '../../hooks/useSecurityInfo';
import { describeUserAgent } from '../../utils/userAgent';
import { SettingsRow } from './SettingsRow';

const MIN_PASSWORD = 8;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ChangePasswordForm({ onChanged }: { onChanged: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setDone(false);
    if (!current) return setError('Enter your current password');
    if (next.length < MIN_PASSWORD) {
      return setError(`New password must be at least ${MIN_PASSWORD} characters`);
    }
    if (next !== confirm) return setError("The new passwords don't match");
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function passwordRow(
    label: string,
    value: string,
    set: (value: string) => void,
    autoComplete: string,
  ) {
    return (
      <SettingsRow label={label}>
        <input
          className="settings-row__input"
          type="password"
          aria-label={label}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => {
            set(event.target.value);
            setDone(false);
          }}
        />
      </SettingsRow>
    );
  }

  return (
    <form className="settings-stack" onSubmit={handleSubmit} noValidate>
      {passwordRow('Current password', current, setCurrent, 'current-password')}
      {passwordRow('New password', next, setNext, 'new-password')}
      {passwordRow('Confirm new password', confirm, setConfirm, 'new-password')}
      <SettingsRow label="">
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : 'Change password'}
        </button>
        {done && <span className="muted">Password changed. Other devices were logged out.</span>}
      </SettingsRow>
      {error && <p className="form-error settings-row__error">{error}</p>}
    </form>
  );
}

/** Danger zone: type the business name and the password to delete everything for good. */
function DeleteAccountSection() {
  const { business, deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!business) return null;

  const confirmed = typedName.trim() === business.name && password.length > 0;

  function close() {
    setOpen(false);
    setTypedName('');
    setPassword('');
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(password);
      // Logged out now: RequireAuth takes the user to /login.
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <>
      <h3 className="settings-section settings-section--danger">Delete account</h3>
      <p className="muted">
        Permanently deletes <strong>{business.name}</strong> and everything in it: inventory, sales,
        expenses, channels, tags, pictures and login history. This can't be undone.
      </p>
      {!open ? (
        <div>
          <button type="button" className="button button--danger" onClick={() => setOpen(true)}>
            Delete account…
          </button>
        </div>
      ) : (
        <form className="settings-stack" onSubmit={handleSubmit} noValidate>
          <SettingsRow label={`Type "${business.name}"`}>
            <input
              className="settings-row__input"
              aria-label="Type your business name to confirm"
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              autoComplete="off"
              autoFocus
            />
          </SettingsRow>
          <SettingsRow label="Your password">
            <input
              className="settings-row__input"
              type="password"
              aria-label="Your password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </SettingsRow>
          <SettingsRow label="">
            <button
              type="submit"
              className="button button--danger"
              disabled={!confirmed || deleting}
            >
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={deleting}
              onClick={close}
            >
              Cancel
            </button>
          </SettingsRow>
          {error && <p className="form-error settings-row__error">{error}</p>}
        </form>
      )}
    </>
  );
}

export function SecurityTab() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { sessions, logins, error, loading, reload } = useSecurityInfo();
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const others = sessions?.filter((session) => !session.current).length ?? 0;

  async function handleLogOutOthers() {
    setLoggingOut(true);
    setActionError(null);
    try {
      await logOutOtherSessions();
      reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <h3 className="settings-section">Change password</h3>
      <ChangePasswordForm onChanged={reload} />

      <h3 className="settings-section">Where you're logged in</h3>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="form-error">{error}</p>}
      {sessions && (
        <ul className="settings-list">
          {sessions.map((session, index) => (
            <li key={index} className="settings-list__item">
              <span>
                {describeUserAgent(session.userAgent)}
                {session.current && <span className="settings-badge">This device</span>}
              </span>
              <span className="muted">Active {formatDateTime(session.lastActiveAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <SettingsRow label="">
        <button
          type="button"
          className="button button--secondary"
          disabled={loggingOut || others === 0}
          onClick={handleLogOutOthers}
        >
          {loggingOut ? 'Logging out…' : 'Log out all other devices'}
        </button>
        <button
          type="button"
          className="button"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          Log out this device
        </button>
      </SettingsRow>
      {actionError && <p className="form-error">{actionError}</p>}

      <h3 className="settings-section">Recent login activity</h3>
      {logins && logins.length === 0 && <p className="muted">No logins recorded yet.</p>}
      {logins && (
        <ul className="settings-list">
          {logins.map((login, index) => (
            <li key={index} className="settings-list__item">
              <span>{describeUserAgent(login.userAgent)}</span>
              <span className="muted">{formatDateTime(login.at)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Don't recognise one? Change your password, which logs out every other device.
      </p>

      <h3 className="settings-section">Two-factor authentication</h3>
      <p className="muted">Add a second step at login with an authenticator app. Coming soon.</p>

      <DeleteAccountSection />
    </>
  );
}
