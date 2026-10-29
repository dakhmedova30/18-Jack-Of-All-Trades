import type { ReactNode } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { AccountTab } from './AccountTab';
import { ProfileTab } from './ProfileTab';
import { SecurityTab } from './SecurityTab';

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

function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <>
      <p className="muted">{children}</p>
      <p className="muted">Coming soon.</p>
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
