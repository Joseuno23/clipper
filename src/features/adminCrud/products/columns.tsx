import type { Column } from "@/widgets/data-table/DataTable";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { RowActions } from "@/shared/components/adminCrud";
import type { ProductDto } from "@/shared/api/adminCrud";

export function productColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (product: ProductDto) => void;
  onDelete: (product: ProductDto) => void;
}): Column<ProductDto>[] {
  return [
    {
      key: "product",
      header: "Producto",
      cell: (product) => (
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.description || product.category || "Sin descripción"}
          </p>
        </div>
      ),
    },
    {
      key: "codes",
      header: "SKU / Código",
      cell: (product) =>
        [product.sku, product.barcode].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "price",
      header: "Precio",
      cell: (product) => formatMoney(product.catalogPrice),
    },
    {
      key: "stock",
      header: "Stock",
      cell: (product) => productStock(product),
    },
    {
      key: "status",
      header: "Estado",
      cell: (product) =>
        product.isActive ? (
          <StatusBadge tone="success">Activo</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Inactivo</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      align: "right",
      cell: (product) => (
        <RowActions
          onEdit={() => onEdit(product)}
          onDelete={() => onDelete(product)}
        />
      ),
    },
  ];
}

export function productStock(product: ProductDto) {
  return product.stock ?? product.currentStock;
}

function formatMoney(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(amount);
}
