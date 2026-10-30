import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { useAuth } from './hooks/useAuth';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ExpensesPage } from './pages/expenses/ExpensesPage';
import { HelpPage } from './pages/HelpPage';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { PrivacyPage } from './pages/legal/PrivacyPage';
import { TermsPage } from './pages/legal/TermsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SalesPage } from './pages/sales/SalesPage';
import { SettingsPage } from './pages/settings/SettingsPage';

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
  return (
    <Routes>
      {/* Public: linked from the account menu, and readable without logging in. */}
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

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
          <Route path="expenses" element={<ExpensesPage />} />
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
