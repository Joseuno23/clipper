import { useMemo, useState } from "react";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { sales as seedSales } from "@/entities/mock-data";
import { findCustomer, findStaff } from "@/entities/selectors";
import { currency, time } from "@/shared/lib/format";
import {
  CreditCard,
  Banknote,
  ArrowLeftRight,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import type { PaymentMethod, Sale } from "@/entities/types";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "open", label: "Abiertas" },
  { key: "paid", label: "Cerradas" },
] as const;

export function SalesView() {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("open");
  const [activeId, setActiveId] = useState<string>(
    seedSales.find((s) => s.status === "open")?.id ?? "",
  );
  const [method, setMethod] = useState<PaymentMethod>("card");

  const filtered = seedSales.filter((s) => s.status === tab);
  const active = useMemo<Sale | undefined>(
    () => seedSales.find((s) => s.id === activeId),
    [activeId],
  );

  const total = active?.items.reduce((a, i) => a + i.unitPrice * i.qty, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Caja"
        description="Tickets abiertos, cobros y ventas del día con servicios + retail."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Receipt className="h-4 w-4" /> Cierre de caja
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nueva venta
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  const first = seedSales.find((s) => s.status === t.key);
                  if (first) setActiveId(first.id);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === t.key
                    ? "bg-surface-elevated text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                  {seedSales.filter((s) => s.status === t.key).length}
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border/60">
              {filtered.map((s) => {
                const customer = findCustomer(s.customerId);
                const member = findStaff(s.staffId);
                const subtotal = s.items.reduce(
                  (a, i) => a + i.unitPrice * i.qty,
                  0,
                );
                const isActive = activeId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(s.id)}
                      className={cn(
                        "flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors",
                        isActive ? "bg-surface/80" : "hover:bg-surface/50",
                      )}
                    >
                      <div className="w-16 shrink-0">
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {s.number}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {time(s.openedAt)}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {customer?.name ?? "Walk-in"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member?.name} · {s.items.length} ítems
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-sm font-semibold tabular-nums text-foreground">
                          {currency(subtotal)}
                        </p>
                        {s.status === "paid" && s.paymentMethod && (
                          <StatusBadge tone="success" dot={false}>
                            {paymentLabel(s.paymentMethod)}
                          </StatusBadge>
                        )}
                        {s.status === "open" && (
                          <StatusBadge tone="warning" dot={false}>
                            Abierta
                          </StatusBadge>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Detail panel */}
        <aside className="sticky top-[76px] h-fit rounded-xl border border-border bg-card">
          {active ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Ticket
                  </p>
                  <p className="font-display text-base font-semibold text-foreground">
                    {active.number}
                  </p>
                </div>
                <StatusBadge
                  tone={active.status === "paid" ? "success" : "warning"}
                >
                  {active.status === "paid" ? "Cobrada" : "En curso"}
                </StatusBadge>
              </div>

              <div className="px-5 py-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ítems
                </p>
                <ul className="space-y-2">
                  {active.items.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/60 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase">
                          {i.kind === "service" ? "SV" : "PR"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {i.name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {i.qty} × {currency(i.unitPrice)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {currency(i.unitPrice * i.qty)}
                      </span>
                      {active.status === "open" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          aria-label="Eliminar ítem"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>

                {active.status === "open" && (
                  <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" /> Agregar ítem
                  </button>
                )}
              </div>

              <div className="border-t border-border px-5 py-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{currency(total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuentos</span>
                  <span className="tabular-nums">{currency(0)}</span>
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    Total
                  </span>
                  <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                    {currency(total)}
                  </span>
                </div>
              </div>

              {active.status === "open" && (
                <div className="space-y-3 border-t border-border px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Método de pago
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["card", "cash", "transfer"] as PaymentMethod[]).map(
                      (m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMethod(m)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
                            method === m
                              ? "border-primary bg-primary/8 text-primary"
                              : "border-border bg-surface/60 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {m === "card" && <CreditCard className="h-4 w-4" />}
                          {m === "cash" && <Banknote className="h-4 w-4" />}
                          {m === "transfer" && (
                            <ArrowLeftRight className="h-4 w-4" />
                          )}
                          {paymentLabel(m)}
                        </button>
                      ),
                    )}
                  </div>
                  <Button className="w-full" size="lg">
                    Cobrar {currency(total)}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Seleccioná un ticket
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function paymentLabel(m: PaymentMethod) {
  return m === "card"
    ? "Tarjeta"
    : m === "cash"
      ? "Efectivo"
      : m === "transfer"
        ? "Transferencia"
        : "Mixto";
}
