import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { useAuth } from './hooks/useAuth';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ExpensesPage } from './pages/expenses/ExpensesPage';
import { DiscountsPage } from './pages/discounts/DiscountsPage';
import { MarketDetailPage } from './pages/markets/MarketDetailPage';
import { MarketsPage } from './pages/markets/MarketsPage';
import { OnlineMonthPage } from './pages/online/OnlineMonthPage';
import { OnlineShopPage } from './pages/online/OnlineShopPage';
import { CommissionDetailPage } from './pages/commissions/CommissionDetailPage';
import { CommissionsPage } from './pages/commissions/CommissionsPage';
import { MiscellaneousDetailPage } from './pages/misc/MiscellaneousDetailPage';
import { MiscellaneousPage } from './pages/misc/MiscellaneousPage';
import { HelpPage } from './pages/HelpPage';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { PrivacyPage } from './pages/legal/PrivacyPage';
import { TermsPage } from './pages/legal/TermsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PublicProfilePage } from './pages/public/PublicProfilePage';
import { SalesPage } from './pages/sales/SalesPage';
import { SettingsPage } from './pages/settings/SettingsPage';

// Imports required fonts
import '@fontsource-variable/fraunces';
import '@fontsource/atkinson-hyperlegible';

/** Everything in here needs a logged-in business; sends anonymous visitors to /login. */
function RequireAuth() {
  const { business, loading } = useAuth();
  if (loading) return <p className="auth-loading muted">Loading…</p>;
  if (!business) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** /login and /register redirect away once you're already logged in. */
function RedirectIfAuthed() {
  const { business, loading } = useAuth();
  if (loading) return <p className="auth-loading muted">Loading…</p>;
  if (business) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Home',
      '/login': 'Log in',
      '/register': 'Register your business',
      '/terms': 'Terms of service',
      '/privacy': 'Privacy policy',
      '/inventory': 'Inventory',
      '/sales': 'Sales',
      '/sales/in-person': 'In-Person Market',
      '/sales/online': 'Online Shop',
      '/sales/commissions': 'Commissions',
      '/sales/misc': 'Miscellaneous',
      '/discounts': 'Discounts & Charges',
      '/expenses': 'Expenses',
      '/analytics': 'Analytics',
      '/help': 'Help and Support',
    };
    const settingsTab = pathname.match(/^\/settings\/([^/]+)$/)?.[1];
    const settingsLabels: Record<string, string> = {
      account: 'Account settings',
      profile: 'Profile settings',
      security: 'Security settings',
      preferences: 'Preferences',
      notifications: 'Notifications',
      appearance: 'Appearance',
    };
    const title =
      titles[pathname] ??
      (pathname.startsWith('/sales/in-person/') ? 'In-Person Market' : undefined) ??
      (pathname.startsWith('/sales/online/') ? 'Online Shop' : undefined) ??
      (pathname.startsWith('/sales/commissions/') ? 'Commissions' : undefined) ??
      (pathname.startsWith('/sales/misc/') ? 'Miscellaneous' : undefined) ??
      (settingsTab ? settingsLabels[settingsTab] : undefined) ??
      (pathname.startsWith('/p/') ? 'Public profile' : 'Page not found');
    document.title = `${title} | Jack-Of-All-Trades`;
  }, [pathname]);

  return (
    <Routes>
      {/* Public: linked from the account menu, and readable without logging in. */}
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      {/* A business's public profile, for customers (no account needed). */}
      <Route path="/p/:slug" element={<PublicProfilePage />} />

      <Route element={<RedirectIfAuthed />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        {/* Every page, Home included, shares AppLayout's sidebar nav. */}
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="sales/in-person" element={<MarketsPage />} />
          <Route path="sales/in-person/:marketId" element={<MarketDetailPage />} />
          <Route path="sales/online" element={<OnlineShopPage />} />
          <Route path="sales/online/:month" element={<OnlineMonthPage />} />
          <Route path="sales/commissions" element={<CommissionsPage />} />
          <Route path="sales/commissions/:commissionId" element={<CommissionDetailPage />} />
          <Route path="sales/misc" element={<MiscellaneousPage />} />
          <Route path="sales/misc/:miscId" element={<MiscellaneousDetailPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="discounts" element={<DiscountsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="settings" element={<Navigate to="/settings/account" replace />} />
          <Route path="settings/:tab" element={<SettingsPage />} />
          {/* Any other path: a real 404 if logged in; RequireAuth sends anonymous
              visitors to /login before this ever renders. */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
