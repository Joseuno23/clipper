import { AppShell } from "@/app/layouts/AppShell";
import { ModuleStub } from "@/shared/components/ModuleStub";

export function ServicesPage() {
  return (
    <AppShell>
      <ModuleStub
        eyebrow="Catálogo"
        title="Servicios"
        description="Catálogo de servicios con duración, precio base, estado y reglas por rol."
        features={[
          "Duración y precio",
          "Roles permitidos",
          "Activo / Inactivo",
          "Reglas de asignación",
          "Variantes",
          "Históricos",
        ]}
      />
    </AppShell>
  );
}
