import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { authKeys, clearAuthSession, me } from "@/shared/api/auth";

type UserAccountMenuProps = {
  variant?: "topbar" | "sidebar";
};

export function UserAccountMenu({ variant = "topbar" }: UserAccountMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authQuery = useQuery({ queryKey: authKeys.me, queryFn: me });
  const userName = authQuery.data?.user.displayName ?? "Usuario";
  const userRole = authQuery.data?.membership.role ?? "STAFF";

  function handleLogout() {
    clearAuthSession();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-3 rounded-lg transition-colors",
            variant === "sidebar"
              ? "w-full bg-sidebar-accent/60 p-2.5 text-left hover:bg-sidebar-accent"
              : "border border-border bg-surface/60 px-2.5 py-1.5 hover:bg-surface",
          )}
          aria-label="Menú de usuario"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initials(userName)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-success" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span
              className={cn(
                "block truncate text-xs font-semibold",
                variant === "sidebar"
                  ? "text-sidebar-accent-foreground"
                  : "text-foreground",
              )}
            >
              {userName}
            </span>
            {variant === "sidebar" && (
              <span className="block truncate text-[10px] text-sidebar-foreground/60">
                {roleLabel(userRole)}
              </span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{userName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="h-4 w-4" />
            Ajustes
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    OWNER: "Propietario",
    ADMIN: "Admin",
    MANAGER: "Manager",
    STAFF: "Staff",
  };

  return labels[role] ?? role;
}
