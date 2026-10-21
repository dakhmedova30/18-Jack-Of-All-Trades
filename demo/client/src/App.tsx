import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { ExpensesPage } from './pages/expenses/ExpensesPage';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/inventory/InventoryPage';
import { SalesPage } from './pages/sales/SalesPage';

export function App() {
  return (
    <Routes>
      {/* Every page, Home included, shares AppLayout's sidebar nav. */}
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
