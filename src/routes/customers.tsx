import { AppShell } from "@/app/layouts/AppShell";
import { ModuleStub } from "@/shared/components/ModuleStub";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CustomersPage() {
  return (
    <AppShell>
      <ModuleStub
        eyebrow="Catálogo"
        title="Clientes"
        description="Listado, búsqueda, alta y edición. Bloqueo, historial y observaciones."
        features={[
          "Búsqueda y filtros",
          "Alta / edición",
          "Bloqueo y notas",
          "Historial de visitas",
          "Lifetime value",
          "Etiquetas",
        ]}
        action={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        }
      />
    </AppShell>
  );
}
