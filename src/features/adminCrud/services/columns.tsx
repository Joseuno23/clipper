import type { Column } from "@/widgets/data-table/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { RowActions } from "@/shared/components/adminCrud";
import type { ServiceDto, StaffRole } from "@/shared/api/adminCrud";

export const staffRoleLabels: Record<StaffRole, string> = {
  BARBER: "Barbero",
  STYLIST: "Estilista",
  COLORIST: "Colorista",
  ASSISTANT: "Asistente",
  MANAGER: "Manager",
};

export const staffRoleOptions = Object.entries(staffRoleLabels).map(
  ([value, label]) => ({ value: value as StaffRole, label }),
);

export function serviceColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (service: ServiceDto) => void;
  onDelete: (service: ServiceDto) => void;
}): Column<ServiceDto>[] {
  return [
    {
      key: "service",
      header: "Servicio",
      cell: (service) => (
        <div>
          <p className="font-medium">{service.name}</p>
          <p className="text-xs text-muted-foreground">
            {service.description || "Sin descripción"}
          </p>
        </div>
      ),
    },
    {
      key: "duration",
      header: "Duración",
      cell: (service) => `${service.durationMinutes} min`,
    },
    {
      key: "price",
      header: "Precio base",
      cell: (service) => formatPrice(service.basePrice),
    },
    {
      key: "roles",
      header: "Roles permitidos",
      cell: (service) =>
        service.allowedRoles.length > 0
          ? service.allowedRoles.map((role) => staffRoleLabels[role]).join(", ")
          : "Sin restricción",
    },
    {
      key: "status",
      header: "Estado",
      cell: (service) =>
        service.isActive ? (
          <StatusBadge tone="success">Activo</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Inactivo</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      align: "right",
      cell: (service) => (
        <RowActions
          onEdit={() => onEdit(service)}
          onDelete={() => onDelete(service)}
        />
      ),
    },
  ];
}

function formatPrice(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(amount);
}
