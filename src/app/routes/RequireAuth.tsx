import { useSyncExternalStore } from "react";
import { Navigate, Outlet } from "react-router";

import { getAuthSession, subscribeAuthSession } from "@/shared/api/auth";

export function RequireAuth() {
  const authSessionKey = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionKey,
    () => null,
  );

  return authSessionKey ? <Outlet /> : <Navigate to="/login" replace />;
}

function getAuthSessionKey() {
  const session = getAuthSession();
  return session ? `${session.shopSlug}:${session.token}` : null;
}
