import type { ReactNode } from 'react';
import { Navigate, NavLink, useParams } from 'react-router-dom';
import { AccountTab } from './AccountTab';
import { AppearanceTab } from './AppearanceTab';
import { NotificationsTab } from './NotificationsTab';
import { PreferencesTab } from './PreferencesTab';
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

const TAB_CONTENT: Record<TabSlug, () => ReactNode> = {
  account: () => <AccountTab />,
  profile: () => <ProfileTab />,
  security: () => <SecurityTab />,
  preferences: () => <PreferencesTab />,
  notifications: () => <NotificationsTab />,
  appearance: () => <AppearanceTab />,
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
        <div className="settings__main">
          <h2 className="settings__title">{current.label}</h2>
          <div className="settings__content card">{TAB_CONTENT[tab]()}</div>
        </div>
      </div>
    </section>
  );
}
