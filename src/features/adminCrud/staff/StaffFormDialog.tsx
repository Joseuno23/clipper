import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CommissionMode,
  ServiceDto,
  StaffCreateInput,
  StaffDto,
  StaffRole,
} from "@/shared/api/adminCrud";
import { adminCrudKeys, servicesApi } from "@/shared/api/adminCrud";

import { commissionModeLabels, staffRoleOptions } from "./columns";

type StaffFormValues = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  photoDataUrl: string | null;
  isActive: boolean;
  specialties: string;
  roles: StaffRole[];
  serviceCommissions: Record<string, StaffServiceCommissionFormValue>;
};

type StaffServiceCommissionFormValue = {
  commissionMode: CommissionMode;
  commissionValue: string;
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
  photoDataUrl: null,
  isActive: true,
  specialties: "",
  roles: [],
  serviceCommissions: {},
};

const SERVICES_PAGE_SIZE = 100;
const SERVICES_LIST_PARAMS = { limit: SERVICES_PAGE_SIZE, offset: 0 };
const STAFF_PHOTO_MAX_BYTES = 360 * 1024;
const STAFF_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  const servicesQuery = useQuery({
    queryKey: adminCrudKeys.servicesList(SERVICES_LIST_PARAMS),
    queryFn: loadAllServices,
    enabled: open,
  });

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
            photoDataUrl: staff.photoDataUrl,
            isActive: staff.isActive,
            specialties: staff.specialties.join(", "),
            roles: staff.roles,
            serviceCommissions: Object.fromEntries(
              staff.serviceCommissions.map((commission) => [
                commission.serviceId,
                {
                  commissionMode: commission.commissionMode,
                  commissionValue: commissionValueToFormInput(
                    commission.commissionMode,
                    commission.commissionValue,
                  ),
                },
              ]),
            ),
          }
        : emptyValues,
    );
    setLocalError(null);
  }, [open, staff]);

  const displayError = useMemo(() => localError ?? error, [error, localError]);
  const matchingServices = useMemo(
    () => filterServicesByRoles(servicesQuery.data ?? [], values.roles),
    [servicesQuery.data, values.roles],
  );
  const requiresServices = values.roles.length > 0;
  const canSubmit =
    !isSubmitting && (!requiresServices || servicesQuery.isSuccess);

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

  function updateServiceCommission(
    serviceId: string,
    value: StaffServiceCommissionFormValue,
  ) {
    setValues((current) => ({
      ...current,
      serviceCommissions: {
        ...current.serviceCommissions,
        [serviceId]: value,
      },
    }));
  }

  async function handlePhotoChange(file: File | undefined) {
    if (!file) return;

    if (!STAFF_PHOTO_TYPES.includes(file.type)) {
      setLocalError("La foto debe ser JPG, PNG o WebP.");
      return;
    }

    if (file.size > STAFF_PHOTO_MAX_BYTES) {
      setLocalError("La foto no puede superar 360 KB.");
      return;
    }

    try {
      updateValue("photoDataUrl", await readFileAsDataUrl(file));
      setLocalError(null);
    } catch {
      setLocalError("No se pudo leer la foto seleccionada.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const firstName = values.firstName.trim();
    const lastName = values.lastName.trim();
    const displayName = values.displayName.trim();

    if (!firstName || !lastName || !displayName) {
      setLocalError("Nombre, apellido y nombre visible son obligatorios.");
      return;
    }

    if (requiresServices && !servicesQuery.isSuccess) {
      setLocalError("Esperá a que carguen los servicios para guardar.");
      return;
    }

    try {
      const serviceCommissions = matchingServices.map((service) => {
        const commission = values.serviceCommissions[service.id] ?? {
          commissionMode: "NONE" as CommissionMode,
          commissionValue: "0",
        };
        const value = Number(commission.commissionValue);

        if (!Number.isFinite(value) || value < 0) {
          throw new Error(
            `La comisión de ${service.name} debe ser mayor o igual a cero.`,
          );
        }

        if (commission.commissionMode === "PERCENTAGE_BPS" && value > 100) {
          throw new Error(
            `La comisión porcentual de ${service.name} no puede superar 100%.`,
          );
        }

        return {
          serviceId: service.id,
          commissionMode: commission.commissionMode,
          commissionValue: commissionValueToApiInput(
            commission.commissionMode,
            commission.commissionValue,
          ),
        };
      });

      setLocalError(null);
      onSubmit({
        firstName,
        lastName,
        displayName,
        email: nullable(values.email),
        phone: nullable(values.phone),
        photoDataUrl: values.photoDataUrl,
        isActive: values.isActive,
        commissionMode: "NONE",
        commissionValue: "0",
        specialties: csv(values.specialties),
        roles: values.roles,
        serviceCommissions,
      });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Comisión inválida.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
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

          <section className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-3">
              {values.photoDataUrl ? (
                <img
                  src={values.photoDataUrl}
                  alt={`Foto de ${values.displayName || "staff"}`}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                  Sin foto
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="staffPhoto">Foto</Label>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG o WebP. Máximo 360 KB.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                id="staffPhoto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  void handlePhotoChange(event.target.files?.[0]);
                  event.target.value = "";
                }}
                disabled={isSubmitting}
              />
              {values.photoDataUrl && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateValue("photoDataUrl", null)}
                  disabled={isSubmitting}
                >
                  Quitar foto
                </Button>
              )}
            </div>
          </section>

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

          <section className="space-y-2">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Servicios y comisiones
              </h3>
              <p className="text-xs text-muted-foreground">
                Se muestran los servicios activos que aceptan al menos uno de
                los roles seleccionados. En porcentaje, escribí el valor humano:
                30 significa 30%.
              </p>
            </div>
            {servicesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Cargando servicios…
              </p>
            ) : servicesQuery.isError ? (
              <p role="alert" className="text-sm text-destructive">
                No se pudieron cargar los servicios para comisiones.
              </p>
            ) : matchingServices.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                Seleccioná roles para ver servicios compatibles.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchingServices.map((service) => {
                      const commission = values.serviceCommissions[
                        service.id
                      ] ?? { commissionMode: "NONE", commissionValue: "0" };

                      return (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">
                            {service.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {service.allowedRoles
                              .map((role) => staffRoleLabel(role))
                              .join(", ")}
                          </TableCell>
                          <TableCell>
                            <select
                              aria-label={`Modo de comisión para ${service.name}`}
                              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                              value={commission.commissionMode}
                              onChange={(event) =>
                                updateServiceCommission(service.id, {
                                  ...commission,
                                  commissionMode: event.target
                                    .value as CommissionMode,
                                  commissionValue:
                                    event.target.value === "NONE"
                                      ? "0"
                                      : commission.commissionValue,
                                })
                              }
                              disabled={isSubmitting}
                            >
                              {Object.entries(commissionModeLabels).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label={`Valor de comisión para ${service.name}`}
                              inputMode="decimal"
                              value={commission.commissionValue}
                              onChange={(event) =>
                                updateServiceCommission(service.id, {
                                  ...commission,
                                  commissionValue: event.target.value,
                                })
                              }
                              disabled={
                                isSubmitting ||
                                commission.commissionMode === "NONE"
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

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
            <Button type="submit" disabled={!canSubmit}>
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

function filterServicesByRoles(services: ServiceDto[], roles: StaffRole[]) {
  if (roles.length === 0) return [];

  const selected = new Set(roles);
  return services.filter(
    (service) =>
      service.isActive &&
      service.allowedRoles.some((role) => selected.has(role)),
  );
}

async function loadAllServices() {
  const services: ServiceDto[] = [];

  for (let offset = 0; ; offset += SERVICES_PAGE_SIZE) {
    const page = await servicesApi.list({ limit: SERVICES_PAGE_SIZE, offset });
    services.push(...page);

    if (page.length < SERVICES_PAGE_SIZE) {
      return services;
    }
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("FileReader result was not a string."));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function staffRoleLabel(role: StaffRole) {
  return (
    staffRoleOptions.find((option) => option.value === role)?.label ?? role
  );
}

function commissionValueToFormInput(mode: CommissionMode, storedValue: string) {
  if (mode !== "PERCENTAGE_BPS") return trimNumericString(storedValue);

  return trimNumericString(String(Number(storedValue) / 100));
}

function commissionValueToApiInput(mode: CommissionMode, formValue: string) {
  if (mode === "NONE") return "0";

  const value = Number(formValue);

  if (mode === "PERCENTAGE_BPS") {
    return String(Math.round(value * 100));
  }

  return formValue.trim();
}

function trimNumericString(value: string) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return value;

  return String(numeric);
}
