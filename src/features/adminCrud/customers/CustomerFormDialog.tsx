import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerCreateInput, CustomerDto } from "@/shared/api/adminCrud";

type CustomerFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  documentNumber: string;
  notes: string;
  isBlocked: boolean;
};

type CustomerFormDialogProps = {
  open: boolean;
  customer?: CustomerDto | null;
  error?: string | null;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CustomerCreateInput) => void;
};

const emptyValues: CustomerFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  documentNumber: "",
  notes: "",
  isBlocked: false,
};

export function CustomerFormDialog({
  open,
  customer,
  error,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: CustomerFormDialogProps) {
  const [values, setValues] = useState<CustomerFormValues>(emptyValues);
  const [localError, setLocalError] = useState<string | null>(null);
  const title = customer ? "Editar cliente" : "Nuevo cliente";

  useEffect(() => {
    if (!open) return;

    setValues(
      customer
        ? {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email ?? "",
            phone: customer.phone ?? "",
            documentNumber: customer.documentNumber ?? "",
            notes: customer.notes ?? "",
            isBlocked: customer.isBlocked,
          }
        : emptyValues,
    );
    setLocalError(null);
  }, [customer, open]);

  const displayError = useMemo(() => localError ?? error, [error, localError]);

  function updateValue<K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();

    if (!firstName || !lastName) {
      setLocalError("Nombre y apellido son obligatorios.");
      return;
    }

    setLocalError(null);
    onSubmit({
      firstName,
      lastName,
      email: nullable(values.email),
      phone: nullable(values.phone),
      documentNumber: nullable(values.documentNumber),
      notes: nullable(values.notes),
      isBlocked: values.isBlocked,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Cargá solo los datos básicos. El servidor sigue siendo la fuente
              de verdad.
            </DialogDescription>
          </DialogHeader>

          {displayError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {displayError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="firstName">
              <Input
                id="firstName"
                value={values.firstName}
                onChange={(event) =>
                  updateValue("firstName", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Apellido" htmlFor="lastName">
              <Input
                id="lastName"
                value={values.lastName}
                onChange={(event) =>
                  updateValue("lastName", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(event) => updateValue("email", event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Teléfono" htmlFor="phone">
              <Input
                id="phone"
                value={values.phone}
                onChange={(event) => updateValue("phone", event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <Field label="Documento" htmlFor="documentNumber">
            <Input
              id="documentNumber"
              value={values.documentNumber}
              onChange={(event) =>
                updateValue("documentNumber", event.target.value)
              }
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Notas" htmlFor="notes">
            <Textarea
              id="notes"
              value={values.notes}
              onChange={(event) => updateValue("notes", event.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={values.isBlocked}
              onCheckedChange={(checked) =>
                updateValue("isBlocked", checked === true)
              }
              disabled={isSubmitting}
            />
            Cliente bloqueado
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
