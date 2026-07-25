import { AppShell } from "@/app/layouts/AppShell";
import { ModuleStub } from "@/shared/components/ModuleStub";

export function ReportsPage() {
  return (
    <AppShell>
      <ModuleStub
        eyebrow="Negocio"
        title="Reportes"
        description="KPIs comerciales y operativos: ventas, servicios estrella y performance por staff."
        features={[
          "Ventas por período",
          "Top servicios",
          "Performance staff",
          "Retención",
          "Productos retail",
          "Comparativos",
        ]}
      />
    </AppShell>
  );
}
