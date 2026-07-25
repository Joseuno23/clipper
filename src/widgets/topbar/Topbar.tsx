import { Search, Bell, Plus, Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/theme/themeContext";
import { Button } from "@/components/ui/button";

export function Topbar() {
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-border bg-background/80 px-5 backdrop-blur-md lg:px-8">
      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label="Buscar"
          placeholder="Buscar clientes, citas, productos…"
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground md:inline-flex">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cambiar tema"
          onClick={toggle}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificaciones"
          className="relative"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nueva cita</span>
        </Button>
      </div>
    </header>
  );
}
