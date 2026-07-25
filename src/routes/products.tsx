import { AppShell } from "@/app/layouts/AppShell";
import { ModuleStub } from "@/shared/components/ModuleStub";

export function ProductsPage() {
  return (
    <AppShell>
      <ModuleStub
        eyebrow="Catálogo"
        title="Productos"
        description="Catálogo retail con SKU, stock, ajustes y visibilidad clara de inventario."
        features={[
          "SKU y precio",
          "Stock y ajustes",
          "Umbral stock bajo",
          "Activo / Inactivo",
          "Movimientos",
          "Reposición",
        ]}
      />
    </AppShell>
  );
}
