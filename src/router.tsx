import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type InitialEntry,
  type RouteObject,
} from "react-router";

import { RequireAuth } from "@/app/routes/RequireAuth";
import { NotFoundPage, RouteErrorBoundary } from "@/app/routes/RouteFallbacks";
import { AppointmentsPage } from "@/routes/appointments";
import { CustomersPage } from "@/routes/customers";
import { DashboardPage } from "@/routes/dashboard";
import { LoginPage } from "@/routes/login";
import { ProductsPage } from "@/routes/products";
import { QueueDisplayPage, QueuePage } from "@/routes/queue";
import { SalesReportPage, StaffLiquidationsReportPage } from "@/routes/reports";
import { SalesPage } from "@/routes/sales";
import { ServicesPage } from "@/routes/services";
import { SettingsPage } from "@/routes/settings";
import { StaffPage } from "@/routes/staff";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "login", element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "appointments", element: <AppointmentsPage /> },
          { path: "queue", element: <QueuePage /> },
          { path: "queue/display", element: <QueueDisplayPage /> },
          { path: "sales", element: <SalesPage /> },
          { path: "customers", element: <CustomersPage /> },
          { path: "services", element: <ServicesPage /> },
          { path: "products", element: <ProductsPage /> },
          { path: "staff", element: <StaffPage /> },
          {
            path: "reports",
            element: <Navigate to="/reports/staff-liquidations" replace />,
          },
          {
            path: "reports/staff-liquidations",
            element: <StaffLiquidationsReportPage />,
          },
          { path: "reports/sales", element: <SalesReportPage /> },
          { path: "settings", element: <SettingsPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);

export function createTestRouter(initialEntries: InitialEntry[]) {
  return createMemoryRouter(appRoutes, { initialEntries });
}
