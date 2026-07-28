import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/widgets/data-table/DataTable";
import {
  appointmentKeys,
  appointmentsApi,
  type AppointmentListItemDto,
} from "@/shared/api/appointments";
import { businessDateInputValue } from "@/shared/lib/businessLocale";
import { time, initials } from "@/shared/lib/format";
import { Calendar, Filter, Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  SCHEDULED: "neutral",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_SERVICE: "primary",
  COMPLETED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "warning",
} as const;

const LABEL = {
  SCHEDULED: "Programada",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Check-in",
  IN_SERVICE: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No-show",
} as const;

const TABS: {
  key: "all" | "scheduled" | "in_service" | "completed";
  label: string;
}[] = [
  { key: "all", label: "Todas" },
  { key: "scheduled", label: "Programadas" },
  { key: "in_service", label: "En curso" },
  { key: "completed", label: "Completadas" },
];

const SOURCE_LABEL = {
  WALK_IN: "Mostrador",
  PHONE: "Teléfono",
  ONLINE: "Online",
  STAFF: "Staff",
} as const;

const AVATAR_COLORS = ["#7c3aed", "#0f766e", "#c2410c", "#be123c"];

export function AppointmentsView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [selectedDate, setSelectedDate] = useState(() =>
    businessDateInputValue(),
  );
  const [showFilters, setShowFilters] = useState(false);

  const appointmentsQuery = useQuery({
    queryKey: appointmentKeys.listByDate(selectedDate),
    queryFn: () => appointmentsApi.listByDate(selectedDate),
  });

  const appointments = appointmentsQuery.data ?? [];

  const rows = appointments.filter((a) =>
    tab === "all" ? true : appointmentTab(a) === tab,
  );

  const counts = Object.fromEntries(
    TABS.map((t) => [
      t.key,
      t.key === "all"
        ? appointments.length
        : appointments.filter((a) => appointmentTab(a) === t.key).length,
    ]),
  ) as Record<(typeof TABS)[number]["key"], number>;

  const columns: Column<AppointmentListItemDto>[] = [
    {
      key: "time",
      header: "Horario",
      width: "120px",
      cell: (a) => (
        <div className="font-mono text-xs tabular-nums">
          <span className="font-semibold text-foreground">
            {time(new Date(a.startAt))}
          </span>
          <span className="text-muted-foreground">
            {" → "}
            {time(new Date(a.endAt))}
          </span>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Cliente",
      cell: (a) => {
        return (
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-primary-foreground"
              style={{ backgroundColor: avatarColor(a.staffMemberId ?? a.id) }}
            >
              {initials(a.clientName)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {a.clientName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Origen: {SOURCE_LABEL[a.source]}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "service",
      header: "Servicio",
      cell: (a) => (
        <span className="text-foreground">
          {a.services.length > 0
            ? a.services.map((service) => service.name).join(" + ")
            : (a.serviceName ?? "Sin servicio")}
        </span>
      ),
    },
    {
      key: "staff",
      header: "Barbero",
      cell: (a) => (
        <span className="text-muted-foreground">
          {a.staffName ?? "Sin asignar"}
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setSelectedDate(businessDateInputValue())}
            >
              <Calendar className="h-4 w-4" /> Hoy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowFilters((current) => !current)}
              aria-expanded={showFilters}
            >
              <Filter className="h-4 w-4" /> Filtros
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nueva cita
            </Button>
          </>
        }
      />

      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="flex w-fit flex-col gap-1 text-xs font-medium text-muted-foreground">
              Día
              <input
                type="date"
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(
                    event.target.value || businessDateInputValue(),
                  )
                }
              />
            </label>
            <p className="max-w-xl text-xs text-muted-foreground">
              Programadas incluye citas programadas, confirmadas y con check-in;
              “En curso” muestra las que ya están en servicio.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-surface-elevated text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {appointmentsQuery.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Cargando citas…
        </div>
      ) : appointmentsQuery.isError ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-destructive">
          No se pudieron cargar las citas.
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          empty={
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No hay citas para este filtro.
            </div>
          }
        />
      )}
    </>
  );
}

function appointmentTab(appointment: AppointmentListItemDto) {
  if (
    appointment.status === "SCHEDULED" ||
    appointment.status === "CONFIRMED" ||
    appointment.status === "CHECKED_IN"
  ) {
    return "scheduled";
  }
  if (appointment.status === "IN_SERVICE") return "in_service";
  if (appointment.status === "COMPLETED") return "completed";
  return "all";
}

function avatarColor(seed: string) {
  const total = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}
