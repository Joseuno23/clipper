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
import type {
  CommissionMode,
  StaffCreateInput,
  StaffDto,
  StaffRole,
} from "@/shared/api/adminCrud";

import { commissionModeLabels, staffRoleOptions } from "./columns";

type StaffFormValues = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  isActive: boolean;
  commissionMode: CommissionMode;
  commissionValue: string;
  specialties: string;
  roles: StaffRole[];
};

type StaffFormDialogProps = {
  open: boolean;
  staff?: StaffDto | null;
  error?: string | null;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: StaffCreateInput) => void;
};

const emptyValues: StaffFormValues = {
  firstName: "",
  lastName: "",
  displayName: "",
  email: "",
  phone: "",
  isActive: true,
  commissionMode: "NONE",
  commissionValue: "0",
  specialties: "",
  roles: [],
};

export function StaffFormDialog({
  open,
  staff,
  error,
  isSubmitting = false,
  onOpenChange,
  onSubmit,
}: StaffFormDialogProps) {
  const [values, setValues] = useState<StaffFormValues>(emptyValues);
  const [localError, setLocalError] = useState<string | null>(null);
  const title = staff ? "Editar staff" : "Nuevo staff";

  useEffect(() => {
    if (!open) return;

    setValues(
      staff
        ? {
            firstName: staff.firstName,
            lastName: staff.lastName,
            displayName: staff.displayName,
            email: staff.email ?? "",
            phone: staff.phone ?? "",
            isActive: staff.isActive,
            commissionMode: staff.commissionMode,
            commissionValue: staff.commissionValue,
            specialties: staff.specialties.join(", "),
            roles: staff.roles,
          }
        : emptyValues,
    );
    setLocalError(null);
  }, [open, staff]);

  const displayError = useMemo(() => localError ?? error, [error, localError]);

  function updateValue<K extends keyof StaffFormValues>(
    key: K,
    value: StaffFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role: StaffRole, checked: boolean) {
    setValues((current) => ({
      ...current,
      roles: checked
        ? [...current.roles, role]
        : current.roles.filter((value) => value !== role),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    const displayName = values.displayName.trim();
    const commissionValue = Number(values.commissionValue);

    if (!firstName || !lastName || !displayName) {
      setLocalError("Nombre, apellido y nombre visible son obligatorios.");
      return;
    }

    if (!Number.isFinite(commissionValue) || commissionValue < 0) {
      setLocalError("La comisión debe ser un número mayor o igual a cero.");
      return;
    }

    setLocalError(null);
    onSubmit({
      firstName,
      lastName,
      displayName,
      email: nullable(values.email),
      phone: nullable(values.phone),
      isActive: values.isActive,
      commissionMode: values.commissionMode,
      commissionValue: values.commissionValue.trim(),
      specialties: csv(values.specialties),
      roles: values.roles,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Editá solo los campos soportados por el API de staff. Sillas y
              disponibilidad quedan fuera de este alcance.
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
            <Field label="Nombre" htmlFor="staffFirstName">
              <Input
                id="staffFirstName"
                value={values.firstName}
                onChange={(event) =>
                  updateValue("firstName", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Apellido" htmlFor="staffLastName">
              <Input
                id="staffLastName"
                value={values.lastName}
                onChange={(event) =>
                  updateValue("lastName", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <Field label="Nombre visible" htmlFor="staffDisplayName">
            <Input
              id="staffDisplayName"
              value={values.displayName}
              onChange={(event) =>
                updateValue("displayName", event.target.value)
              }
              disabled={isSubmitting}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email" htmlFor="staffEmail">
              <Input
                id="staffEmail"
                type="email"
                value={values.email}
                onChange={(event) => updateValue("email", event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
            <Field label="Teléfono" htmlFor="staffPhone">
              <Input
                id="staffPhone"
                value={values.phone}
                onChange={(event) => updateValue("phone", event.target.value)}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Modo de comisión" htmlFor="commissionMode">
              <select
                id="commissionMode"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                value={values.commissionMode}
                onChange={(event) =>
                  updateValue(
                    "commissionMode",
                    event.target.value as CommissionMode,
                  )
                }
                disabled={isSubmitting}
              >
                {Object.entries(commissionModeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor de comisión" htmlFor="commissionValue">
              <Input
                id="commissionValue"
                inputMode="decimal"
                value={values.commissionValue}
                onChange={(event) =>
                  updateValue("commissionValue", event.target.value)
                }
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <Field label="Especialidades" htmlFor="staffSpecialties">
            <Input
              id="staffSpecialties"
              placeholder="Corte, color, barba"
              value={values.specialties}
              onChange={(event) =>
                updateValue("specialties", event.target.value)
              }
              disabled={isSubmitting}
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Roles
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {staffRoleOptions.map((role) => (
                <label
                  key={role.value}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={values.roles.includes(role.value)}
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

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={values.isActive}
              onCheckedChange={(checked) =>
                updateValue("isActive", checked === true)
              }
              disabled={isSubmitting}
            />
            Staff activo
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

function csv(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );
}
