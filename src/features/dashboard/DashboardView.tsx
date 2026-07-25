import {
  Calendar,
  Wallet,
  Users,
  Clock,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { MetricCard } from "@/widgets/metrics/MetricCard";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { appointments, sales, queue, products } from "@/entities/mock-data";
import { findCustomer, findStaff, findService } from "@/entities/selectors";
import { currency, time, initials } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE = {
  scheduled: "neutral",
  checked_in: "info",
  in_progress: "primary",
  completed: "success",
  cancelled: "destructive",
  no_show: "warning",
} as const;

const STATUS_LABEL = {
  scheduled: "Programada",
  checked_in: "Check-in",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No-show",
} as const;

export function DashboardView() {
  const today = new Date();
  const todays = appointments;
  const openSales = sales.filter((s) => s.status === "open");
  const paidToday = sales.filter((s) => s.status === "paid");
  const totalRevenue = paidToday.reduce(
    (acc, s) => acc + s.items.reduce((a, i) => a + i.unitPrice * i.qty, 0),
    0,
  );
  const lowStock = products.filter((p) => p.stock <= p.lowStockThreshold);

  return (
    <>
      <PageHeader
        eyebrow="Operación · Hoy"
        title="Buenos días, Sofía"
        description={`Resumen ejecutivo del ${today.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}.`}
        actions={
          <>
            <Button variant="outline" size="sm">
              Exportar
            </Button>
            <Button size="sm">Abrir caja</Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Ventas del día"
          value={currency(totalRevenue)}
          delta={{ value: "+18.2%", positive: true }}
          hint="vs. ayer"
          icon={<Wallet className="h-4 w-4" />}
        />
        <MetricCard
          label="Citas hoy"
          value={todays.length}
          delta={{ value: "+3", positive: true }}
          hint={`${todays.filter((a) => a.status === "completed").length} completadas`}
          icon={<Calendar className="h-4 w-4" />}
        />
        <MetricCard
          label="En cola"
          value={queue.length}
          hint="espera promedio 14 min"
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Ticket pendiente"
          value={openSales.length}
          delta={{ value: "-1", positive: false }}
          hint="ventas abiertas"
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
                {todays.length} citas programadas
              </p>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              Ver agenda <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ul className="divide-y divide-border/60">
            {todays.slice(0, 6).map((a) => {
              const customer = findCustomer(a.customerId);
              const member = findStaff(a.staffId);
              const service = findService(a.serviceIds[0]);
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface/60"
                >
                  <div className="w-14 shrink-0 text-right">
                    <p className="font-display text-sm font-semibold tabular-nums text-foreground">
                      {time(a.start)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {service?.durationMin}m
                    </p>
                  </div>
                  <div className="h-9 w-px bg-border" />
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
                      style={{ backgroundColor: member?.avatarColor }}
                    >
                      {initials(customer?.name ?? "")}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {customer?.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {service?.name} · {member?.name}
                      </p>
                    </div>
                  </div>
                  <StatusBadge tone={STATUS_TONE[a.status]}>
                    {STATUS_LABEL[a.status]}
                  </StatusBadge>
                </li>
              );
            })}
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
              {lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/60 p-3"
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      p.stock === 0 ? "bg-destructive" : "bg-warning",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.stock === 0
                        ? "Sin stock"
                        : `Stock bajo · ${p.stock} unidades`}
                    </p>
                  </div>
                </li>
              ))}
              <li className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/60 p-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-info" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    Iván Soto sin disponibilidad
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pausado para nuevas reservas
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-foreground">
              Accesos rápidos
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Nueva cita", icon: Calendar },
                { label: "Cobrar", icon: Wallet },
                { label: "Cliente", icon: Users },
                { label: "Cola", icon: Clock },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface/60 p-3 text-left transition-colors hover:border-border-strong hover:bg-surface"
                >
                  <q.icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">
                    {q.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
