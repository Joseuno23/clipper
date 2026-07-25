import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  offset: number;
  limit: number;
  hasNext: boolean;
  isFetching?: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function PaginationControls({
  offset,
  limit,
  hasNext,
  isFetching = false,
  onPrevious,
  onNext,
}: PaginationControlsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Mostrando desde {offset + 1} · {limit} por página
        {isFetching ? " · Actualizando…" : ""}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={offset === 0 || isFetching}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext || isFetching}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
