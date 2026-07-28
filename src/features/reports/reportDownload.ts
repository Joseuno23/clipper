import type {
  SalesReportDto,
  StaffLiquidationReportDto,
} from "@/shared/api/reports";

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(csvRow).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function salesReportCsvRows(report: SalesReportDto) {
  return [
    ["Fecha", "Venta", "Tipo", "Cliente", "Ítem", "Cantidad", "Staff", "Total"],
    ...report.days.flatMap((day) =>
      day.items.map((item) => [
        day.date,
        item.saleNumber,
        item.itemType === "SERVICE" ? "Servicio" : "Producto",
        item.clientName,
        item.itemName,
        String(item.quantity),
        item.staffName ?? "",
        item.total,
      ]),
    ),
  ];
}

export function staffLiquidationCsvRows(report: StaffLiquidationReportDto) {
  return [
    [
      "Fecha",
      "Staff",
      "Venta",
      "Cliente",
      "Servicio",
      "Cantidad",
      "Vendido",
      "Comisión",
    ],
    ...report.details.flatMap((detail) =>
      detail.days.flatMap((day) =>
        day.items.map((item) => [
          day.date,
          detail.staffName,
          item.saleNumber,
          item.clientName,
          item.serviceName,
          String(item.quantity),
          item.soldTotal,
          item.commissionTotal,
        ]),
      ),
    ),
  ];
}

function csvRow(values: string[]) {
  return values.map(csvCell).join(",");
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
