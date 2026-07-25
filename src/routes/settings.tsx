import { AppShell } from "@/app/layouts/AppShell";
import { ModuleStub } from "@/shared/components/ModuleStub";

export function SettingsPage() {
  return (
    <AppShell>
      <ModuleStub
        eyebrow="Negocio"
        title="Configuración"
        description="Datos del tenant, horarios, reglas operativas, permisos y parámetros clave."
        features={[
          "Datos del tenant",
          "Horarios y feriados",
          "Roles y permisos",
          "Parámetros operativos",
          "Notificaciones",
          "Auditoría",
        ]}
      />
    </AppShell>
  );
}
