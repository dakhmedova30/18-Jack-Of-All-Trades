import type { ReactNode } from 'react';
import { AuthProvider } from '../hooks/useAuth';
import { PreferencesProvider } from '../hooks/usePreferences';

/**
 * The providers a logged-in page sits inside (see AppLayout), for rendering one page or form on
 * its own: `render(<InventoryPage />, { wrapper: PageProviders })`. AuthProvider loads the
 * business on mount, so a test using this must mock `getCurrentBusiness` in `api/auth`. With no
 * business, preferences are the defaults.
 */
export function PageProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </AuthProvider>
  );
}
