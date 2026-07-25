import { AppShell } from "@/app/layouts/AppShell";
import { ServicesCrudPage } from "@/features/adminCrud/services/ServicesPage";

export function ServicesPage() {
  return (
    <AppShell>
      <ServicesCrudPage />
    </AppShell>
  );
}
