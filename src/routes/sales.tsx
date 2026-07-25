import { AppShell } from "@/app/layouts/AppShell";
import { SalesView } from "@/features/sales/SalesView";

export function SalesPage() {
  return (
    <AppShell>
      <SalesView />
    </AppShell>
  );
}
