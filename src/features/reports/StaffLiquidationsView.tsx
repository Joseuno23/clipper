import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/components/PageHeader";
import { adminCrudKeys, staffApi } from "@/shared/api/adminCrud";
import {
  reportKeys,
  reportsApi,
  type StaffLiquidationStaffDetailDto,
} from "@/shared/api/reports";
import { currency, longDate } from "@/shared/lib/format";
import { businessDateInputValue } from "@/shared/lib/businessLocale";

import { reportLoadErrorMessage } from "./reportError";

export function StaffLiquidationsView() {
  const today = useMemo(() => todayInputValue(), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [staffMemberId, setStaffMemberId] = useState("all");
  const [detailStaffId, setDetailStaffId] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: adminCrudKeys.staffList({ limit: 100, offset: 0 }),
    queryFn: () => staffApi.list({ limit: 100, offset: 0 }),
  });
  const reportQuery = useQuery({
    queryKey: reportKeys.staffLiquidations({ from, to, staffMemberId }),
    queryFn: () => reportsApi.staffLiquidations({ from, to, staffMemberId }),
  });

  const summaries = reportQuery.data?.summaries ?? [];
  const selectedDetail =
    reportQuery.data?.details?.find(
      (detail) => detail.staffMemberId === detailStaffId,
    ) ?? null;
  const totals = summaries.reduce(
    (acc, item) => ({
      sold: acc.sold + Number(item.soldTotal),
      commission: acc.commission + Number(item.commissionTotal),
      orders: acc.orders + item.orderCount,
      lines: acc.lines + item.serviceLineCount,
    }),
    { sold: 0, commission: 0, orders: 0, lines: 0 },
  );

  return (
    <>
      <PageHeader
        title="Liquidación de staff"
        description="Servicios cobrados por profesional y comisión a pagar. Productos excluidos."
      />

      <section className="space-y-5">
        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Desde
            <input
              type="date"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value || today);
                setDetailStaffId(null);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Hasta
            <input
              type="date"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={to}
              onChange={(event) => {
                setTo(event.target.value || today);
                setDetailStaffId(null);
              }}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground md:col-span-2">
            Staff
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={staffMemberId}
              onChange={(event) => {
                setStaffMemberId(event.target.value);
                setDetailStaffId(null);
              }}
            >
              <option value="all">Todos</option>
              {(staffQuery.data ?? []).map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Servicios vendidos" value={currency(totals.sold)} />
          <Metric
            label="Comisión a pagar"
            value={currency(totals.commission)}
          />
          <Metric label="Órdenes" value={String(totals.orders)} />
          <Metric label="Líneas de servicio" value={String(totals.lines)} />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Resumen por staff
            </h2>
          </div>
          {reportQuery.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">
              Cargando liquidación…
            </p>
          ) : reportQuery.isError ? (
            <p className="p-5 text-sm text-destructive">
              {reportLoadErrorMessage(reportQuery.error)}
            </p>
          ) : summaries.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No hay servicios cobrados para los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Staff</th>
                    <th className="px-5 py-3 text-right">Vendido</th>
                    <th className="px-5 py-3 text-right">Comisión</th>
                    <th className="px-5 py-3 text-right">Órdenes / líneas</th>
                    <th className="px-5 py-3 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {summaries.map((summary) => (
                    <tr key={summary.staffMemberId}>
                      <td className="px-5 py-3 font-medium text-foreground">
                        {summary.staffName}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {currency(Number(summary.soldTotal))}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {currency(Number(summary.commissionTotal))}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground">
                        {summary.orderCount} / {summary.serviceLineCount}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            setDetailStaffId(summary.staffMemberId)
                          }
                        >
                          Ver detalle <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedDetail && <StaffDetail detail={selectedDetail} />}
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

function StaffDetail({ detail }: { detail: StaffLiquidationStaffDetailDto }) {
  return (
    <aside className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <ReceiptText className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Detalle de {detail.staffName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {currency(Number(detail.soldTotal))} vendidos,{" "}
            {currency(Number(detail.commissionTotal))} a pagar
          </p>
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {detail.days.map((day) => (
          <section key={day.date} className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">
                {longDate(day.date)}
              </h3>
              <p className="text-sm text-muted-foreground">
                Vendido {currency(Number(day.soldTotal))} · Comisión{" "}
                {currency(Number(day.commissionTotal))}
              </p>
            </div>
            <ul className="space-y-2">
              {day.items.map((item) => (
                <li
                  key={`${item.saleId}-${item.serviceName}`}
                  className="grid gap-2 rounded-lg border border-border/60 bg-surface/60 p-3 text-sm md:grid-cols-[120px_1fr_auto]"
                >
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {item.saleNumber}
                  </span>
                  <span>
                    <strong>{item.clientName}</strong> · {item.serviceName} (
                    {item.quantity})
                  </span>
                  <span className="text-right tabular-nums">
                    {currency(Number(item.soldTotal))} /{" "}
                    {currency(Number(item.commissionTotal))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

function todayInputValue() {
  return businessDateInputValue();
}
