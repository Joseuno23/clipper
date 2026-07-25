import type { Column } from "@/widgets/data-table/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { RowActions } from "@/shared/components/adminCrud";
import type { CustomerDto } from "@/shared/api/adminCrud";

export function customerDisplayName(customer: CustomerDto) {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

export function customerColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (customer: CustomerDto) => void;
  onDelete: (customer: CustomerDto) => void;
}): Column<CustomerDto>[] {
  return [
    {
      key: "name",
      header: "Cliente",
      cell: (customer) => (
        <div>
          <p className="font-medium">{customerDisplayName(customer)}</p>
          <p className="text-xs text-muted-foreground">
            {customer.documentNumber || "Sin documento"}
          </p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contacto",
      cell: (customer) => (
        <div className="space-y-1 text-sm">
          <p>{customer.phone || "Sin teléfono"}</p>
          <p className="text-xs text-muted-foreground">
            {customer.email || "Sin email"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (customer) =>
        customer.isBlocked ? (
          <StatusBadge tone="destructive">Bloqueado</StatusBadge>
        ) : (
          <StatusBadge tone="success">Activo</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      align: "right",
      cell: (customer) => (
        <RowActions
          onEdit={() => onEdit(customer)}
          onDelete={() => onDelete(customer)}
        />
      ),
    },
  ];
}
