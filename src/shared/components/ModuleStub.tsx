import { PageHeader } from "@/shared/components/PageHeader";
import { EmptyState } from "@/shared/components/EmptyState";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { Construction } from "lucide-react";

interface ModuleStubProps {
  eyebrow: string;
  title: string;
  description: string;
  features: string[];
  action?: ReactNode;
}

export function ModuleStub({
  eyebrow,
  title,
  description,
  features,
  action,
}: ModuleStubProps) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={action}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {features.map((f) => (
          <div key={f} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 h-1.5 w-8 rounded-full bg-primary/40" />
            <p className="text-sm font-medium text-foreground">{f}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Definido en arquitectura · listo para implementación
            </p>
          </div>
        ))}
      </div>
      <EmptyState
        icon={<Construction className="h-5 w-5" />}
        title="Módulo en preparación"
        description="La arquitectura, entidades y rutas ya están listas. Conectá data y formularios para activarlo."
        action={
          <Button size="sm" variant="outline">
            Ver especificación
          </Button>
        }
      />
    </>
  );
}
