import { AppShell } from "@/app/layouts/AppShell";
import { DashboardView } from "@/features/dashboard/DashboardView";

export function DashboardPage() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
