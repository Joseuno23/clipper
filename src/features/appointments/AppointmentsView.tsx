import { useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/widgets/data-table/DataTable";
import { appointments } from "@/entities/mock-data";
import { findCustomer, findStaff, findService } from "@/entities/selectors";
import { time, initials } from "@/shared/lib/format";
import { Calendar, Filter, Plus, MoreHorizontal } from "lucide-react";
import type { Appointment } from "@/entities/types";

const TONE = {
  scheduled: "neutral",
  checked_in: "info",
  in_progress: "primary",
  completed: "success",
  cancelled: "destructive",
  no_show: "warning",
} as const;

const LABEL = {
  scheduled: "Programada",
  checked_in: "Check-in",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No-show",
} as const;

const TABS: {
  key: "all" | "scheduled" | "in_progress" | "completed";
  label: string;
}[] = [
  { key: "all", label: "Todas" },
  { key: "scheduled", label: "Programadas" },
  { key: "in_progress", label: "En curso" },
  { key: "completed", label: "Completadas" },
];

export function AppointmentsView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");

  const rows = appointments.filter((a) =>
    tab === "all" ? true : a.status === tab,
  );

  const columns: Column<Appointment>[] = [
    {
      key: "time",
      header: "Horario",
      width: "120px",
      cell: (a) => (
        <div className="font-mono text-xs tabular-nums">
          <span className="font-semibold text-foreground">{time(a.start)}</span>
          <span className="text-muted-foreground"> → {time(a.end)}</span>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Cliente",
      cell: (a) => {
        const c = findCustomer(a.customerId);
        const m = findStaff(a.staffId);
        return (
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-primary-foreground"
              style={{ backgroundColor: m?.avatarColor }}
            >
              {initials(c?.name ?? "")}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{c?.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c?.phone}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "service",
      header: "Servicio",
      cell: (a) => {
        const items = a.serviceIds
          .map((id) => findService(id)?.name)
          .filter(Boolean);
        return <span className="text-foreground">{items.join(" + ")}</span>;
      },
    },
    {
      key: "staff",
      header: "Barbero",
      cell: (a) => (
        <span className="text-muted-foreground">
          {findStaff(a.staffId)?.name}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (a) => (
        <StatusBadge tone={TONE[a.status]}>{LABEL[a.status]}</StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "60px",
      cell: () => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Acciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Citas"
        description="Agenda del día, próximas reservas, check-in y reasignación."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Calendar className="h-4 w-4" /> Hoy
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="h-4 w-4" /> Filtros
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nueva cita
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count =
            t.key === "all"
              ? appointments.length
              : appointments.filter((a) => a.status === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                active
                  ? "flex items-center gap-2 rounded-md bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground shadow-xs"
                  : "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              }
            >
              {t.label}
              <span
                className={
                  active
                    ? "rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground"
                    : "rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground"
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(a) => a.id} />
    </>
  );
}
