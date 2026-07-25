import type { Column } from "@/widgets/data-table/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { RowActions } from "@/shared/components/adminCrud";
import type {
  CommissionMode,
  StaffDto,
  StaffRole,
} from "@/shared/api/adminCrud";

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

export const commissionModeLabels: Record<CommissionMode, string> = {
  NONE: "Sin comisión",
  PERCENTAGE_BPS: "Porcentaje",
  FIXED_AMOUNT: "Monto fijo",
};

export function staffColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (staff: StaffDto) => void;
  onDelete: (staff: StaffDto) => void;
}): Column<StaffDto>[] {
  return [
    {
      key: "staff",
      header: "Staff",
      cell: (staff) => (
        <div>
          <p className="font-medium">{staff.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {[staff.email, staff.phone].filter(Boolean).join(" · ") ||
              "Sin contacto"}
          </p>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      cell: (staff) =>
        staff.roles.length > 0
          ? staff.roles.map((role) => staffRoleLabels[role]).join(", ")
          : "Sin roles",
    },
    {
      key: "specialties",
      header: "Especialidades",
      cell: (staff) =>
        staff.specialties.length > 0
          ? staff.specialties.join(", ")
          : "Sin especialidades",
    },
    {
      key: "commission",
      header: "Comisión",
      cell: (staff) =>
        `${commissionModeLabels[staff.commissionMode]} · ${formatCommission(staff)}`,
    },
    {
      key: "status",
      header: "Estado",
      cell: (staff) =>
        staff.isActive ? (
          <StatusBadge tone="success">Activo</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Inactivo</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      align: "right",
      cell: (staff) => (
        <RowActions
          onEdit={() => onEdit(staff)}
          onDelete={() => onDelete(staff)}
        />
      ),
    },
  ];
}

function formatCommission(staff: StaffDto) {
  if (staff.commissionMode === "NONE") return "0";
  if (staff.commissionMode === "PERCENTAGE_BPS") {
    const bps = Number(staff.commissionValue);
    if (!Number.isFinite(bps)) return staff.commissionValue;
    return `${bps / 100}%`;
  }

  const amount = Number(staff.commissionValue);
  if (!Number.isFinite(amount)) return staff.commissionValue;

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(amount);
}
