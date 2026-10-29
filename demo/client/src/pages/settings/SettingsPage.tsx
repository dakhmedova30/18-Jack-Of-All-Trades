import type { ReactNode } from 'react';
import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../hooks/useAuth';

const TABS = [
  { slug: 'account', label: 'Account' },
  { slug: 'profile', label: 'Profile' },
  { slug: 'security', label: 'Security' },
  { slug: 'preferences', label: 'Preferences' },
  { slug: 'notifications', label: 'Notifications' },
  { slug: 'appearance', label: 'Appearance' },
] as const;

type TabSlug = (typeof TABS)[number]['slug'];

function isTabSlug(value: string | undefined): value is TabSlug {
  return TABS.some((tab) => tab.slug === value);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-row__label muted">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <>
      <p className="muted">{children}</p>
      <p className="muted">Coming soon.</p>
    </>
  );
}

function AccountTab() {
  const { business } = useAuth();
  if (!business) return null;
  return (
    <>
      <Row label="Business name">{business.name}</Row>
      <Row label="Email">{business.email}</Row>
      <Row label="Member since">
        {new Date(business.createdAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </Row>
    </>
  );
}

function ProfileTab() {
  const { business } = useAuth();
  if (!business) return null;
  return (
    <>
      <div className="settings-profile">
        <Avatar name={business.name} />
        <p className="muted">
          No profile picture yet, so your initials are shown. Uploading a picture is coming soon.
        </p>
      </div>
    </>
  );
}

function SecurityTab() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <Row label="This device">
        <button
          type="button"
          className="button"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          Log out
        </button>
      </Row>
      <ComingSoon>Changing your password will be available here.</ComingSoon>
    </>
  );
}

const TAB_CONTENT: Record<TabSlug, () => ReactNode> = {
  account: () => <AccountTab />,
  profile: () => <ProfileTab />,
  security: () => <SecurityTab />,
  preferences: () => (
    <ComingSoon>
      Manage sales channels and expense tags, the low-stock threshold, and currency and date
      formats.
    </ComingSoon>
  ),
  notifications: () => (
    <ComingSoon>
      Choose which emails you get, like low-stock alerts and weekly summaries.
    </ComingSoon>
  ),
  appearance: () => <ComingSoon>Light and dark mode, and table density.</ComingSoon>,
};

/** /settings/<tab>: a vertical list of tabs on the left, the chosen tab's content on the right. */
export function SettingsPage() {
  const { tab } = useParams();
  if (!isTabSlug(tab)) return <Navigate to="/settings/account" replace />;
  const current = TABS.find((t) => t.slug === tab)!;

  return (
    <section className="page">
      <h1>Settings</h1>
      <div className="settings">
        <nav className="settings__tabs" aria-label="Settings sections">
          {TABS.map(({ slug, label }) => (
            <NavLink key={slug} to={`/settings/${slug}`} className="settings__tab">
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="settings__content card">
          <h2>{current.label}</h2>
          {TAB_CONTENT[tab]()}
        </div>
      </div>
    </section>
  );
}
