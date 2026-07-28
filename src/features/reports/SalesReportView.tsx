import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/shared/components/PageHeader";
import {
  adminCrudKeys,
  productsApi,
  servicesApi,
} from "@/shared/api/adminCrud";
import {
  reportKeys,
  reportsApi,
  type SalesReportItemType,
} from "@/shared/api/reports";
import { businessDateInputValue } from "@/shared/lib/businessLocale";
import { currency, longDate } from "@/shared/lib/format";

import { reportLoadErrorMessage } from "./reportError";

export function SalesReportView() {
  const today = useMemo(() => businessDateInputValue(), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [itemType, setItemType] = useState<SalesReportItemType>("all");
  const [serviceId, setServiceId] = useState("all");
  const [productId, setProductId] = useState("all");

  const servicesQuery = useQuery({
    queryKey: adminCrudKeys.servicesList({ limit: 100, offset: 0 }),
    queryFn: () => servicesApi.list({ limit: 100, offset: 0 }),
  });
  const productsQuery = useQuery({
    queryKey: adminCrudKeys.productsList({ limit: 100, offset: 0 }),
    queryFn: () => productsApi.list({ limit: 100, offset: 0 }),
  });
  const reportQuery = useQuery({
    queryKey: reportKeys.sales({ from, to, itemType, serviceId, productId }),
    queryFn: () =>
      reportsApi.sales({ from, to, itemType, serviceId, productId }),
  });

  const summary = reportQuery.data?.summary;
  const days = reportQuery.data?.days ?? [];

  return (
    <>
      <PageHeader
        title="Reporte de ventas"
        description="Ventas cobradas por día, incluyendo servicios y productos."
      />

      <section className="space-y-5">
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-5">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Desde
            <input
              type="date"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={from}
              onChange={(event) => setFrom(event.target.value || today)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Hasta
            <input
              type="date"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={to}
              onChange={(event) => setTo(event.target.value || today)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Tipo
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={itemType}
              onChange={(event) =>
                setItemType(event.target.value as SalesReportItemType)
              }
            >
              <option value="all">Todos</option>
              <option value="SERVICE">Servicios</option>
              <option value="PRODUCT">Productos</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Servicio
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="all">Todos</option>
              {(servicesQuery.data ?? []).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Producto
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="all">Todos</option>
              {(productsQuery.data ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          <Metric
            label="Total"
            value={currency(Number(summary?.totalRevenue ?? 0))}
          />
          <Metric
            label="Servicios"
            value={currency(Number(summary?.servicesRevenue ?? 0))}
          />
          <Metric
            label="Productos"
            value={currency(Number(summary?.productsRevenue ?? 0))}
          />
          <Metric label="Órdenes" value={String(summary?.orderCount ?? 0)} />
          <Metric label="Líneas" value={String(summary?.itemLineCount ?? 0)} />
          <Metric
            label="Unidades"
            value={String(summary?.quantityTotal ?? 0)}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Detalle por día
            </h2>
          </div>
          {reportQuery.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">
              Cargando ventas…
            </p>
          ) : reportQuery.isError ? (
            <p className="p-5 text-sm text-destructive">
              {reportLoadErrorMessage(reportQuery.error)}
            </p>
          ) : days.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No hay ventas para los filtros seleccionados.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {days.map((day) => (
                <section key={day.date} className="p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-foreground">
                      {longDate(day.date)}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Total {currency(Number(day.totalRevenue))} · Servicios{" "}
                      {currency(Number(day.servicesRevenue))} · Productos{" "}
                      {currency(Number(day.productsRevenue))}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {day.items.map((item) => (
                      <li
                        key={item.saleId + item.itemName + item.itemType}
                        className="grid gap-2 rounded-lg border border-border/60 bg-surface/60 p-3 text-sm md:grid-cols-[120px_100px_1fr_auto]"
                      >
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {item.saleNumber}
                        </span>
                        <span
                          className={salesItemTypeBadgeClass(item.itemType)}
                        >
                          {salesItemTypeLabel(item.itemType)}
                        </span>
                        <span>
                          <strong>{item.clientName}</strong> · {item.itemName} (
                          {item.quantity})
                          {item.staffName ? ` · ${item.staffName}` : ""}
                        </span>
                        <span className="text-right tabular-nums">
                          {currency(Number(item.total))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function salesItemTypeLabel(itemType: "SERVICE" | "PRODUCT") {
  return itemType === "SERVICE" ? "Servicio" : "Producto";
}

function salesItemTypeBadgeClass(itemType: "SERVICE" | "PRODUCT") {
  const baseClass = "text-xs font-semibold";

  return itemType === "SERVICE"
    ? `${baseClass} text-sky-300`
    : `${baseClass} text-amber-300`;
}
