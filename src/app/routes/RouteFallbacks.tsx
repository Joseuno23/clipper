import { useEffect } from "react";
import { Link, useRouteError } from "react-router";

import { reportLovableError } from "@/lib/lovable-error-reporting";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground">
          Página no encontrada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          La ruta que buscás no existe o fue movida.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Volver al dashboard
        </Link>
      </div>
    </div>
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    const resolvedError =
      error instanceof Error ? error : new Error("Unknown route error");
    reportLovableError(resolvedError, {
      boundary: "react_router_error_boundary",
    });
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          Esta página no cargó
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo salió mal de nuestro lado. Reintentá o volvé al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reintentar
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir al dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
