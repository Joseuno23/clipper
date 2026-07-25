import { AppShell } from "@/app/layouts/AppShell";
import { CustomersCrudPage } from "@/features/adminCrud/customers/CustomersPage";

export function CustomersPage() {
  return (
    <AppShell>
      <CustomersCrudPage />
    </AppShell>
  );
}
