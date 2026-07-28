import { AppShell } from "@/app/layouts/AppShell";
import { SalesReportView } from "@/features/reports/SalesReportView";
import { StaffLiquidationsView } from "@/features/reports/StaffLiquidationsView";

export function StaffLiquidationsReportPage() {
  return (
    <AppShell>
      <StaffLiquidationsView />
    </AppShell>
  );
}

export function SalesReportPage() {
  return (
    <AppShell>
      <SalesReportView />
    </AppShell>
  );
}
