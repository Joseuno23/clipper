import { AppShell } from "@/app/layouts/AppShell";
import { AppointmentsView } from "@/features/appointments/AppointmentsView";

export function AppointmentsPage() {
  return (
    <AppShell>
      <AppointmentsView />
    </AppShell>
  );
}
