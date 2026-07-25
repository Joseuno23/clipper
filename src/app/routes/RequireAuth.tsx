import { Navigate, Outlet } from "react-router";

import { getAuthSession } from "@/shared/api/auth";

export function RequireAuth() {
  return getAuthSession() ? <Outlet /> : <Navigate to="/login" replace />;
}
