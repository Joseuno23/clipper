import { AppShell } from "@/app/layouts/AppShell";
import { StaffCrudPage } from "@/features/adminCrud/staff/StaffPage";

export function StaffPage() {
  return (
    <AppShell>
      <StaffCrudPage />
    </AppShell>
  );
}
