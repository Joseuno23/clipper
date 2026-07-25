import { NavLink, useLocation } from "react-router";
import {
  LayoutDashboard,
  Calendar,
  ListOrdered,
  Wallet,
  Users,
  Scissors,
  Package,
  UserCog,
  BarChart3,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  badge?: string;
}

const primary: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Citas", to: "/appointments", icon: Calendar, badge: "7" },
  { label: "Cola", to: "/queue", icon: ListOrdered, badge: "3" },
  { label: "Caja", to: "/sales", icon: Wallet },
];

const catalog: NavItem[] = [
  { label: "Clientes", to: "/customers", icon: Users },
  { label: "Servicios", to: "/services", icon: Scissors },
  { label: "Productos", to: "/products", icon: Package },
  { label: "Staff", to: "/staff", icon: UserCog },
];

const insights: NavItem[] = [
  { label: "Reportes", to: "/reports", icon: BarChart3 },
  { label: "Configuración", to: "/settings", icon: Settings },
];

function NavGroup({
  label,
  items,
  activePath,
}: {
  label: string;
  items: NavItem[];
  activePath: string;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
        {label}
      </p>
      {items.map((item) => {
        const active =
          activePath === item.to || activePath.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "group flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <span className="flex items-center gap-3">
              <Icon
                className={cn(
                  "h-[18px] w-[18px]",
                  active
                    ? "text-primary"
                    : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground",
                )}
              />
              {item.label}
            </span>
            {item.badge && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-sidebar-accent text-sidebar-foreground/70",
                )}
              >
                {item.badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="hidden h-screen w-[244px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-[60px] items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-sidebar-accent-foreground">
            Clipper
          </p>
          <p className="text-[10px] text-sidebar-foreground/60">
            Atelier Barber Co.
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <NavGroup label="Operación" items={primary} activePath={pathname} />
        <NavGroup label="Catálogo" items={catalog} activePath={pathname} />
        <NavGroup label="Negocio" items={insights} activePath={pathname} />
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/60 p-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            SC
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold text-sidebar-accent-foreground">
              Sofía Castro
            </p>
            <p className="truncate text-[10px] text-sidebar-foreground/60">
              Admin · growth plan
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
