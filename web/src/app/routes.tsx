import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/app/app-layout';
import { OrdersPage } from '@/features/orders/orders-page';
import { SalePage } from '@/features/sale/sale-page';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<SalePage />} />
        <Route path="/orders" element={<OrdersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
