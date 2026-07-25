import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/shared/components/EmptyState";

type TableStateProps = {
  kind: "loading" | "empty" | "error";
  title: string;
  description?: string;
  action?: ReactNode;
  onRetry?: () => void;
};

export function TableState({
  kind,
  title,
  description,
  action,
  onRetry,
}: TableStateProps) {
  const icon =
    kind === "loading" ? (
      <Loader2 className="h-5 w-5 animate-spin" />
    ) : kind === "error" ? (
      <AlertCircle className="h-5 w-5" />
    ) : undefined;

  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={
        action ??
        (kind === "error" && onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        ) : undefined)
      }
    />
  );
}
