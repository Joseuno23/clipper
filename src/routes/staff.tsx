import { AppShell } from "@/app/layouts/AppShell";
import { ModuleStub } from "@/shared/components/ModuleStub";

export function StaffPage() {
  return (
    <AppShell>
      <ModuleStub
        eyebrow="Catálogo"
        title="Staff"
        description="Barberos y especialistas: rol, comisión, disponibilidad y perfil operativo."
        features={[
          "Rol y comisión",
          "Disponibilidad",
          "Especialidades",
          "Perfil y avatar",
          "Performance",
          "Permisos",
        ]}
      />
    </AppShell>
  );
}
