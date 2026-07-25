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
import type {
  ServiceCreateInput,
  ServiceDto,
  StaffRole,
} from "@/shared/api/adminCrud";

import { staffRoleOptions } from "./columns";

type ServiceFormValues = {
  name: string;
  description: string;
  durationMinutes: string;
  basePrice: string;
  allowedRoles: StaffRole[];
};

type ServiceFormDialogProps = {
  open: boolean;
  service?: ServiceDto | null;
  error?: string | null;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ServiceCreateInput) => void;
};

const emptyValues: ServiceFormValues = {
  name: "",
  description: "",
  durationMinutes: "",
  basePrice: "",
  allowedRoles: [],
};

export function ServiceFormDialog({
  open,
  service,
  error,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: ServiceFormDialogProps) {
  const [values, setValues] = useState<ServiceFormValues>(emptyValues);
  const [localError, setLocalError] = useState<string | null>(null);
  const title = service ? "Editar servicio" : "Nuevo servicio";

  useEffect(() => {
    if (!open) return;

    setValues(
      service
        ? {
            name: service.name,
            description: service.description ?? "",
            durationMinutes: String(service.durationMinutes),
            basePrice: service.basePrice,
            allowedRoles: service.allowedRoles,
          }
        : emptyValues,
    );
    setLocalError(null);
  }, [open, service]);

  const displayError = useMemo(() => localError ?? error, [error, localError]);

  function updateValue<K extends keyof ServiceFormValues>(
    key: K,
    value: ServiceFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: StaffRole, checked: boolean) {
    setValues((current) => ({
      ...current,
      allowedRoles: checked
        ? [...current.allowedRoles, role]
        : current.allowedRoles.filter((value) => value !== role),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = values.name.trim();
    const durationMinutes = Number(values.durationMinutes);
    const basePrice = Number(values.basePrice);

    if (!name) {
      setLocalError("El nombre del servicio es obligatorio.");
      return;
    }

    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setLocalError("La duración debe ser un número entero mayor a cero.");
      return;
    }

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setLocalError("El precio base debe ser un número mayor o igual a cero.");
      return;
    }

    setLocalError(null);
    onSubmit({
      name,
      description: nullable(values.description),
      durationMinutes,
      basePrice: values.basePrice.trim(),
      allowedRoles: values.allowedRoles,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Definí duración, precio base y los roles que pueden realizarlo.
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

          <Field label="Nombre" htmlFor="serviceName">
            <Input
              id="serviceName"
              value={values.name}
              onChange={(event) => updateValue("name", event.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          <Field label="Descripción" htmlFor="serviceDescription">
            <Textarea
              id="serviceDescription"
              value={values.description}
              onChange={(event) =>
                updateValue("description", event.target.value)
              }
              disabled={isSubmitting}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Duración (minutos)" htmlFor="durationMinutes">
              <Input
                id="durationMinutes"
                inputMode="numeric"
                value={values.durationMinutes}
                onChange={(event) =>
                  updateValue("durationMinutes", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Precio base" htmlFor="basePrice">
              <Input
                id="basePrice"
                inputMode="decimal"
                value={values.basePrice}
                onChange={(event) =>
                  updateValue("basePrice", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Roles permitidos
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {staffRoleOptions.map((role) => (
                <label
                  key={role.value}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={values.allowedRoles.includes(role.value)}
                    onCheckedChange={(checked) =>
                      toggleRole(role.value, checked === true)
                    }
                    disabled={isSubmitting}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </fieldset>

          {service && (
            <p className="text-xs text-muted-foreground">
              Estado actual: {service.isActive ? "activo" : "inactivo"}. El API
              de servicios no expone edición directa de estado; eliminá el
              servicio para darlo de baja.
            </p>
          )}

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
