import {
  Calendar,
  Wallet,
  Users,
  Clock,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { MetricCard } from "@/widgets/metrics/MetricCard";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { adminCrudKeys, productsApi } from "@/shared/api/adminCrud";
import { authKeys, me } from "@/shared/api/auth";
import { appointmentKeys, appointmentsApi } from "@/shared/api/appointments";
import { queueApi, queueKeys } from "@/shared/api/queue";
import { reportKeys, reportsApi } from "@/shared/api/reports";
import { salesApi, salesKeys } from "@/shared/api/sales";
import { businessDateInputValue } from "@/shared/lib/businessLocale";
import { currency, time, initials } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE = {
  SCHEDULED: "neutral",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_SERVICE: "primary",
  COMPLETED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "warning",
} as const;

const STATUS_LABEL = {
  SCHEDULED: "Programada",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Check-in",
  IN_SERVICE: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No-show",
} as const;

const AVATAR_COLORS = ["#7c3aed", "#0f766e", "#c2410c", "#be123c"];

export function DashboardView() {
  const today = new Date();
  const todayKey = businessDateInputValue(today);
  const salesReportQuery = useQuery({
    queryKey: reportKeys.sales({ from: todayKey, to: todayKey }),
    queryFn: () => reportsApi.sales({ from: todayKey, to: todayKey }),
  });
  const appointmentsQuery = useQuery({
    queryKey: appointmentKeys.listByDate(todayKey),
    queryFn: () => appointmentsApi.listByDate(todayKey),
  });
  const queueQuery = useQuery({
    queryKey: queueKeys.live,
    queryFn: queueApi.live,
  });
  const openSalesQuery = useQuery({
    queryKey: salesKeys.list({ status: "open", date: todayKey, limit: 100 }),
    queryFn: () =>
      salesApi.list({ status: "open", date: todayKey, limit: 100 }),
  });
  const productsQuery = useQuery({
    queryKey: adminCrudKeys.productsList({ limit: 100, offset: 0 }),
    queryFn: () => productsApi.list({ limit: 100, offset: 0 }),
  });
  const authQuery = useQuery({ queryKey: authKeys.me, queryFn: me });

  const todays = appointmentsQuery.data ?? [];
  const openSales = openSalesQuery.data ?? [];
  const queueTickets = (queueQuery.data?.queues ?? []).flatMap(
    (staffQueue) => staffQueue.tickets,
  );
  const waitingTickets = queueTickets.filter(
    (ticket) =>
      (ticket.queueStatus === "WAITING" || ticket.queueStatus === "CALLED") &&
      ticket.queuedAt,
  );
  const avgWaitMinutes = waitingTickets.length
    ? Math.round(
        waitingTickets.reduce(
          (total, ticket) =>
            total +
            Math.max(
              0,
              today.getTime() - new Date(ticket.queuedAt!).getTime(),
            ) /
              60000,
          0,
        ) / waitingTickets.length,
      )
    : 0;
  const lowStock = (productsQuery.data ?? []).filter((product) => {
    if (product.lowStockAt === null) return false;
    return product.currentStock <= product.lowStockAt;
  });
  const totalRevenue = Number(salesReportQuery.data?.summary.totalRevenue ?? 0);
  const completedAppointments = todays.filter(
    (appointment) => appointment.status === "COMPLETED",
  ).length;
  const displayName = authQuery.data?.user.displayName?.trim();
  const greetingName = displayName || authQuery.data?.user.email || "equipo";

  return (
    <>
      <PageHeader
        eyebrow="Operación · Hoy"
        title={`Buenos días, ${greetingName}`}
        description={`Resumen ejecutivo del ${today.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}.`}
        actions={
          <>
            <Button variant="outline" size="sm" disabled>
              Exportar
            </Button>
            <Button asChild size="sm">
              <Link to="/sales">Abrir caja</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ventas del día"
          value={salesReportQuery.isLoading ? "..." : currency(totalRevenue)}
          hint={
            salesReportQuery.isError
              ? "No se pudo cargar"
              : `${salesReportQuery.data?.summary.orderCount ?? 0} ventas cobradas`
          }
          icon={<Wallet className="h-4 w-4" />}
        />
        <MetricCard
          label="Citas hoy"
          value={appointmentsQuery.isLoading ? "..." : todays.length}
          hint={
            appointmentsQuery.isError
              ? "No se pudo cargar"
              : `${completedAppointments} completadas`
          }
          icon={<Calendar className="h-4 w-4" />}
        />
        <MetricCard
          label="En cola"
          value={queueQuery.isLoading ? "..." : queueTickets.length}
          hint={
            queueQuery.isError
              ? "No se pudo cargar"
              : waitingTickets.length
                ? `espera promedio ${avgWaitMinutes} min`
                : "sin espera activa"
          }
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Ticket pendiente"
          value={openSalesQuery.isLoading ? "..." : openSales.length}
          hint={
            openSalesQuery.isError ? "No se pudo cargar" : "ventas abiertas"
          }
          icon={<Users className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-border bg-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <h2 className="font-display text-sm font-semibold text-foreground">
                Agenda de hoy
              </h2>
              <p className="text-xs text-muted-foreground">
                {appointmentsQuery.isError
                  ? "No se pudo cargar la agenda"
                  : `${todays.length} citas programadas`}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/appointments">
                Ver agenda <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <ul className="divide-y divide-border/60">
            {appointmentsQuery.isLoading && (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                Cargando agenda...
              </li>
            )}
            {appointmentsQuery.isError && (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                No se pudo cargar la agenda de hoy.
              </li>
            )}
            {!appointmentsQuery.isLoading &&
              !appointmentsQuery.isError &&
              todays.length === 0 && (
                <li className="px-5 py-6 text-sm text-muted-foreground">
                  No hay citas programadas para hoy.
                </li>
              )}
            {todays.slice(0, 6).map((appointment, index) => (
              <li
                key={appointment.id}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface/60"
              >
                <div className="w-14 shrink-0 text-right">
                  <p className="font-display text-sm font-semibold tabular-nums text-foreground">
                    {time(new Date(appointment.startAt))}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {appointment.serviceDurationMinutes ?? "--"}m
                  </p>
                </div>
                <div className="h-9 w-px bg-border" />
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
                    style={{
                      backgroundColor:
                        AVATAR_COLORS[index % AVATAR_COLORS.length],
                    }}
                  >
                    {initials(appointment.clientName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {appointment.clientName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appointment.serviceName ?? "Sin servicio"} ·{" "}
                      {appointment.staffName ?? "Sin staff"}
                    </p>
                  </div>
                </div>
                <StatusBadge tone={STATUS_TONE[appointment.status]}>
                  {STATUS_LABEL[appointment.status]}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-foreground">
                Alertas
              </h2>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <ul className="space-y-3">
              {productsQuery.isLoading && (
                <li className="rounded-lg border border-border/60 bg-surface/60 p-3 text-sm text-muted-foreground">
                  Cargando alertas...
                </li>
              )}
              {productsQuery.isError && (
                <li className="rounded-lg border border-border/60 bg-surface/60 p-3 text-sm text-muted-foreground">
                  No se pudieron cargar las alertas de stock.
                </li>
              )}
              {!productsQuery.isLoading &&
                !productsQuery.isError &&
                lowStock.length === 0 && (
                  <li className="rounded-lg border border-border/60 bg-surface/60 p-3 text-sm text-muted-foreground">
                    Sin alertas de stock bajo.
                  </li>
                )}
              {lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/60 p-3"
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      p.currentStock === 0 ? "bg-destructive" : "bg-warning",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.currentStock === 0
                        ? "Sin stock"
                        : `Stock bajo · ${p.currentStock} unidades`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-foreground">
              Accesos rápidos
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Nueva cita", icon: Calendar, to: "/appointments" },
                { label: "Cobrar", icon: Wallet, to: "/sales" },
                { label: "Cliente", icon: Users, to: "/customers" },
                { label: "Cola", icon: Clock, to: "/queue" },
              ].map((q) => (
                <Link
                  key={q.label}
                  to={q.to}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface/60 p-3 text-left transition-colors hover:border-border-strong hover:bg-surface"
                >
                  <q.icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">
                    {q.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
