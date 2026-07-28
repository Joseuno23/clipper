import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  Minus,
  Plus,
  Receipt,
  Trash2,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { CancelReasonDialog } from "@/shared/components/CancelReasonDialog";
import { ConfirmationDialog } from "@/shared/components/ConfirmationDialog";
import {
  adminCrudKeys,
  productsApi,
  servicesApi,
} from "@/shared/api/adminCrud";
import {
  salesApi,
  salesKeys,
  type PaymentMethod,
  type SaleDto,
} from "@/shared/api/sales";
import { queueKeys } from "@/shared/api/queue";
import { currency, time } from "@/shared/lib/format";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "open", label: "Abiertas" },
  { key: "closed", label: "Cerradas" },
  { key: "cancelled", label: "Canceladas" },
] as const;
const SALES_PAGE_SIZE = 25;

export function SalesView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("open");
  const [activeId, setActiveId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("TRANSFER");
  const [serviceId, setServiceId] = useState("");
  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(() => todayInputValue());
  const [page, setPage] = useState(0);
  const [saleToCancel, setSaleToCancel] = useState<SaleDto | null>(null);
  const [saleToComplete, setSaleToComplete] = useState<{
    sale: SaleDto;
    method: PaymentMethod;
  } | null>(null);
  const salesOffset = page * SALES_PAGE_SIZE;

  const salesQuery = useQuery({
    queryKey: salesKeys.list({
      status: tab,
      date,
      limit: SALES_PAGE_SIZE,
      offset: salesOffset,
    }),
    queryFn: () =>
      salesApi.list({
        status: tab,
        date,
        limit: SALES_PAGE_SIZE,
        offset: salesOffset,
      }),
  });
  const servicesQuery = useQuery({
    queryKey: adminCrudKeys.servicesList({ limit: 100, offset: 0 }),
    queryFn: () => servicesApi.list({ limit: 100, offset: 0 }),
  });
  const productsQuery = useQuery({
    queryKey: adminCrudKeys.productsList({ limit: 100, offset: 0 }),
    queryFn: () => productsApi.list({ limit: 100, offset: 0 }),
  });

  const sales = salesQuery.data ?? [];
  const filtered = sales;
  const hasPreviousPage = page > 0;
  const hasNextPage = sales.length === SALES_PAGE_SIZE;
  const active: SaleDto | undefined =
    sales.find((sale) => sale.id === activeId) ?? filtered[0];

  useEffect(() => {
    if (!active && filtered[0]) setActiveId(filtered[0].id);
  }, [active, filtered]);

  const refreshSales = () =>
    queryClient.invalidateQueries({ queryKey: salesKeys.all });
  const refreshQueue = () =>
    queryClient.invalidateQueries({ queryKey: queueKeys.live });

  const createMutation = useMutation({
    mutationFn: () => salesApi.createManual(),
    onSuccess: async (sale) => {
      setTab("open");
      setActiveId(sale.id);
      await refreshSales();
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof salesApi.update>[1]) =>
      salesApi.update(active!.id, input),
    onSuccess: async (sale) => {
      setActiveId(sale.id);
      setServiceId("");
      setProductId("");
      await refreshSales();
    },
  });
  const completeMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: PaymentMethod }) =>
      salesApi.complete(id, { method }),
    onSuccess: async (sale) => {
      setSaleToComplete(null);
      setTab("closed");
      setActiveId(sale.id);
      await Promise.all([refreshSales(), refreshQueue()]);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      salesApi.cancel(id, { reason }),
    onSuccess: async (sale) => {
      setSaleToCancel(null);
      setTab("cancelled");
      setActiveId(sale.id);
      await Promise.all([refreshSales(), refreshQueue()]);
    },
  });

  const isDraft = active?.status === "DRAFT";
  const total = Number(active?.total ?? 0);
  const activeClientLabel = active ? saleClientLabel(active) : "";

  const updateProductQuantity = (itemId: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1) return;
    updateMutation.mutate({
      action: "updateItemQuantity",
      itemId,
      quantity,
    });
  };

  const confirmAndComplete = () => {
    if (!active) return;
    setSaleToComplete({ sale: active, method });
  };

  const confirmAndCancel = () => {
    if (!active) return;
    setSaleToCancel(active);
  };

  return (
    <>
      <PageHeader
        eyebrow="Operación"
        title="Caja"
        description="Tickets abiertos, cobros y ventas del día con servicios + retail."
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Receipt className="h-4 w-4" /> Cierre de caja · Próximamente
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              <Plus className="h-4 w-4" /> Nueva venta
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-card p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setPage(0);
                  setActiveId("");
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
                  {tab === t.key ? sales.length : "—"}
                </span>
              </button>
            ))}
          </div>

          <label className="flex w-fit items-center gap-2 text-xs font-medium text-muted-foreground">
            Día
            <input
              type="date"
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
              value={date}
              onChange={(event) => {
                setDate(event.target.value || todayInputValue());
                setPage(0);
                setActiveId("");
              }}
            />
          </label>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {salesQuery.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">
                Cargando ventas…
              </div>
            ) : salesQuery.isError ? (
              <div className="p-6 text-sm text-destructive">
                No se pudieron cargar las ventas.
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No hay ventas en esta bandeja.
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {filtered.map((sale) => {
                  const isActive = active?.id === sale.id;
                  return (
                    <li key={sale.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(sale.id)}
                        className={cn(
                          "flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors",
                          isActive ? "bg-surface/80" : "hover:bg-surface/50",
                        )}
                      >
                        <div className="w-24 shrink-0">
                          <p className="font-mono text-xs font-semibold text-foreground">
                            {sale.number}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {time(new Date(sale.createdAt))}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {sale.clientName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {sale.staffName ?? "Sin profesional"} ·{" "}
                            {sale.items.length} ítems
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-sm font-semibold tabular-nums text-foreground">
                            {currency(Number(sale.total))}
                          </p>
                          <StatusBadge
                            tone={
                              sale.status === "DRAFT"
                                ? "warning"
                                : sale.status === "CANCELLED"
                                  ? "destructive"
                                  : "success"
                            }
                            dot={false}
                          >
                            {sale.status === "DRAFT"
                              ? "Abierta"
                              : sale.status === "CANCELLED"
                                ? "Cancelada"
                                : paymentLabel(sale.payments[0]?.method)}
                          </StatusBadge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Pagination className="justify-between rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Página {page + 1} · {filtered.length} ventas
            </p>
            <PaginationContent>
              <PaginationItem>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasPreviousPage || salesQuery.isFetching}
                  onClick={() => {
                    setPage((current) => Math.max(0, current - 1));
                    setActiveId("");
                  }}
                >
                  Anterior
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hasNextPage || salesQuery.isFetching}
                  onClick={() => {
                    setPage((current) => current + 1);
                    setActiveId("");
                  }}
                >
                  Siguiente
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>

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
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {activeClientLabel}
                  </p>
                  {active.appointmentId && (
                    <p className="text-xs text-muted-foreground">
                      Vinculado a cola
                    </p>
                  )}
                </div>
                <StatusBadge
                  tone={
                    isDraft
                      ? "warning"
                      : active.status === "CANCELLED"
                        ? "destructive"
                        : "success"
                  }
                >
                  {isDraft
                    ? "En curso"
                    : active.status === "CANCELLED"
                      ? "Cancelada"
                      : "Cobrada"}
                </StatusBadge>
              </div>

              <div className="px-5 py-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ítems
                </p>
                <ul className="space-y-2">
                  {active.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface/60 p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <span className="text-[10px] font-semibold uppercase">
                          {item.kind === "SERVICE" ? "SV" : "PR"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {item.quantity} × {currency(Number(item.unitPrice))}
                        </p>
                        {isDraft && item.kind === "PRODUCT" && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={`Bajar cantidad de ${item.description}`}
                              disabled={
                                item.quantity <= 1 || updateMutation.isPending
                              }
                              onClick={() =>
                                updateProductQuantity(
                                  item.id,
                                  item.quantity - 1,
                                )
                              }
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <input
                              aria-label={`Cantidad de ${item.description}`}
                              className="h-7 w-14 rounded-md border border-input bg-background px-2 text-center text-xs tabular-nums"
                              min={1}
                              inputMode="numeric"
                              type="number"
                              value={item.quantity}
                              disabled={updateMutation.isPending}
                              onChange={(event) =>
                                updateProductQuantity(
                                  item.id,
                                  Number(event.target.value),
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={`Subir cantidad de ${item.description}`}
                              disabled={updateMutation.isPending}
                              onClick={() =>
                                updateProductQuantity(
                                  item.id,
                                  item.quantity + 1,
                                )
                              }
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {currency(Number(item.total))}
                      </span>
                      {isDraft && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          aria-label="Eliminar ítem"
                          onClick={() =>
                            updateMutation.mutate({
                              action: "removeItem",
                              itemId: item.id,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>

                {isDraft && (
                  <div className="mt-3 grid gap-2 rounded-lg border border-dashed border-border p-3">
                    <div className="flex gap-2">
                      <select
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={serviceId}
                        onChange={(event) => setServiceId(event.target.value)}
                      >
                        <option value="">Agregar servicio…</option>
                        {(servicesQuery.data ?? []).map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!serviceId || updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            action: "addItem",
                            kind: "SERVICE",
                            serviceId,
                          })
                        }
                      >
                        Agregar
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={productId}
                        onChange={(event) => setProductId(event.target.value)}
                      >
                        <option value="">Agregar producto…</option>
                        {(productsQuery.data ?? []).map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!productId || updateMutation.isPending}
                        onClick={() =>
                          updateMutation.mutate({
                            action: "addItem",
                            kind: "PRODUCT",
                            productId,
                          })
                        }
                      >
                        Agregar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border px-5 py-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {currency(Number(active.subtotal))}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuentos</span>
                  <span className="tabular-nums">
                    {currency(Number(active.discountTotal))}
                  </span>
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

              {isDraft && (
                <div className="space-y-3 border-t border-border px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Método de pago
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CARD", "CASH", "TRANSFER"] as PaymentMethod[]).map(
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
                          {m === "CARD" && <CreditCard className="h-4 w-4" />}
                          {m === "CASH" && <Banknote className="h-4 w-4" />}
                          {m === "TRANSFER" && (
                            <ArrowLeftRight className="h-4 w-4" />
                          )}
                          {paymentLabel(m)}
                        </button>
                      ),
                    )}
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={
                      active.items.length === 0 || completeMutation.isPending
                    }
                    onClick={confirmAndComplete}
                  >
                    Cobrar {currency(total)}
                  </Button>
                  <Button
                    className="w-full gap-1.5"
                    variant="outline"
                    disabled={cancelMutation.isPending}
                    onClick={confirmAndCancel}
                  >
                    <XCircle className="h-4 w-4" /> Cancelar orden
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
      <CancelReasonDialog
        open={saleToCancel !== null}
        title="Cancelar orden"
        description="Confirmá la cancelación con un motivo obligatorio."
        context={[
          {
            label: "Cliente",
            value: saleToCancel ? saleClientLabel(saleToCancel) : null,
          },
          { label: "Orden", value: saleToCancel?.number },
        ]}
        isSubmitting={cancelMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setSaleToCancel(null);
        }}
        onConfirm={(reason) => {
          if (!saleToCancel) return;
          cancelMutation.mutate({ id: saleToCancel.id, reason });
        }}
      />
      <ConfirmationDialog
        open={saleToComplete !== null}
        title="Confirmar cobro"
        description="Confirmá el cierre de la orden antes de registrar el pago."
        context={[
          {
            label: "Cliente",
            value: saleToComplete ? saleClientLabel(saleToComplete.sale) : null,
          },
          { label: "Orden", value: saleToComplete?.sale.number },
          {
            label: "Total",
            value: saleToComplete
              ? currency(Number(saleToComplete.sale.total))
              : null,
          },
          {
            label: "Método",
            value: saleToComplete ? paymentLabel(saleToComplete.method) : null,
          },
        ]}
        confirmLabel="Confirmar"
        submittingLabel="Cobrando…"
        isSubmitting={completeMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setSaleToComplete(null);
        }}
        onConfirm={() => {
          if (!saleToComplete) return;
          completeMutation.mutate({
            id: saleToComplete.sale.id,
            method: saleToComplete.method,
          });
        }}
      />
    </>
  );
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function paymentLabel(m?: PaymentMethod) {
  if (m === "CARD") return "Tarjeta";
  if (m === "CASH") return "Efectivo";
  if (m === "TRANSFER") return "Transferencia";
  return "Mixto";
}

function saleClientLabel(sale: SaleDto) {
  const clientName = sale.clientName.trim();

  if (clientName) return clientName;
  return sale.appointmentId ? "Sin cliente" : "Venta manual";
}
