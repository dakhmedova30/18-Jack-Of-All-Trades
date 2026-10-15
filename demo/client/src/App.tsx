import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { SalesPage } from './pages/sales/SalesPage';

export function App() {
  return (
    <Routes>
      {/* Home has its own minimal shell (logo only); dashboards share AppLayout's
          sidebar nav, so once you're inside one you never need to come back here. */}
      <Route index element={<HomePage />} />
      <Route element={<AppLayout />}>
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
