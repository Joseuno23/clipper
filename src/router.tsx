import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type InitialEntry,
  type RouteObject,
} from "react-router";

import { NotFoundPage, RouteErrorBoundary } from "@/app/routes/RouteFallbacks";
import { AppointmentsPage } from "@/routes/appointments";
import { CustomersPage } from "@/routes/customers";
import { DashboardPage } from "@/routes/dashboard";
import { LoginPage } from "@/routes/login";
import { ProductsPage } from "@/routes/products";
import { QueuePage } from "@/routes/queue";
import { ReportsPage } from "@/routes/reports";
import { SalesPage } from "@/routes/sales";
import { ServicesPage } from "@/routes/services";
import { SettingsPage } from "@/routes/settings";
import { StaffPage } from "@/routes/staff";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "login", element: <LoginPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "appointments", element: <AppointmentsPage /> },
      { path: "queue", element: <QueuePage /> },
      { path: "sales", element: <SalesPage /> },
      { path: "customers", element: <CustomersPage /> },
      { path: "services", element: <ServicesPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "staff", element: <StaffPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);

export function createTestRouter(initialEntries: InitialEntry[]) {
  return createMemoryRouter(appRoutes, { initialEntries });
}
