import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CancelReasonDialogProps = {
  open: boolean;
  title: string;
  description: string;
  context: Array<{ label: string; value?: string | null }>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
};

export function CancelReasonDialog({
  open,
  title,
  description,
  context,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: CancelReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("El motivo de cancelación es obligatorio.");
      return;
    }

    setError(null);
    onConfirm(trimmedReason);
  };

  return (
    <Dialog open={open} onOpenChange={isSubmitting ? undefined : onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <dl className="grid gap-2 rounded-lg border border-border bg-surface/60 p-3 text-sm">
            {context
              .filter((item) => item.value?.trim())
              .map((item) => (
                <div key={item.label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="text-right font-medium text-foreground">
                    {item.value}
                  </dd>
                </div>
              ))}
          </dl>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Motivo</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              disabled={isSubmitting}
              onChange={(event) => {
                setReason(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Escribí el motivo de cancelación"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "cancel-reason-error" : undefined}
            />
            {error && (
              <p
                id="cancel-reason-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Cancelando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
